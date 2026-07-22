import { NextRequest, NextResponse } from "next/server";
import { DateTime } from "luxon";
import { getPrisma } from "@/lib/prisma";
import { getUserPrisma } from "@/lib/user-prisma";
import { isPushConfigured, sendPush, type PushPayload } from "@/lib/web-push";
import { buildAlertMessage } from "@/lib/alert-messages";
import {
  buildShowReminderMessage,
  type ReminderShow,
} from "@/lib/show-reminder-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ————————————————————————————————————————————————————————————————————————
// MOTEUR D'ALERTES (déclenché ~toutes les 1-2 min par une Dokploy Schedule, comme
// le fetch des temps du worker). Il compare le temps d'attente RÉEL de chaque
// attraction surveillée à son seuil et envoie un push quand le temps DESCEND à
// ≤ seuil.
//
// Anti-spam : déclenchement sur FRONT (pas sur niveau). Chaque alerte porte un
// drapeau `armed` (voir schéma) :
//   - on envoie seulement quand `armed` ET temps ≤ seuil, puis on désarme ;
//   - on réarme quand le temps repasse nettement au-dessus (seuil + REARM_MARGIN).
// Ainsi une file qui reste courte n'envoie qu'UN push, pas un par passage.
// ————————————————————————————————————————————————————————————————————————

// Marge de réarmement au-dessus du seuil : évite le « flapping » (alertes en
// rafale) quand le temps oscille juste autour du seuil.
const REARM_MARGIN = 5;

// Protection de l'endpoint : un secret partagé avec la Dokploy Schedule. Accepté
// en `Authorization: Bearer <secret>` ou en `?key=<secret>`.
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.ALERTS_CRON_SECRET;
  if (!secret) return false; // pas de secret configuré = endpoint fermé.
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return request.nextUrl.searchParams.get("key") === secret;
}

const DEFAULT_LOCALE = "fr";

type UserPrismaClient = ReturnType<typeof getUserPrisma>;
type PrismaClient = ReturnType<typeof getPrisma>;

type ShowReminderSummary = {
  remindersFired: number;
  remindersSent: number;
  remindersPurged: number;
};

// —————————————————————— Rappels de spectacles (temporels) ——————————————————————
// Passe indépendante du moteur d'alertes (seuils) : on envoie un push aux rappels
// dont `fireAt` est atteint et qui n'ont pas encore été envoyés. Contrairement aux
// alertes, le déclenchement est TEMPOREL (pas de seuil / réarmement).
async function processShowReminders(
  userPrisma: UserPrismaClient,
  prisma: PrismaClient,
): Promise<ShowReminderSummary> {
  const now = new Date();

  // Rappels arrivés à échéance (tous ceux en base sont « en attente » : les
  // envoyés ont déjà été déplacés en historique puis supprimés).
  const due = await userPrisma.showReminder.findMany({
    where: { fireAt: { lte: now } },
  });
  // On n'envoie QUE si la représentation n'a pas encore commencé (sinon rappel
  // manqué : le cron a pris du retard). Les manqués sont nettoyés plus bas.
  const toSend = due.filter((r) => r.startTime.getTime() > now.getTime());

  const summary: ShowReminderSummary = {
    remindersFired: toSend.length,
    remindersSent: 0,
    remindersPurged: 0,
  };

  if (toSend.length > 0) {
    // Fuseau + format horaire pour un libellé « à 16:00 » lisible.
    const parkIds = [...new Set(toSend.map((r) => r.parkIdentifier))];
    const userIds = [...new Set(toSend.map((r) => r.userId))];
    const [parks, subs, prefs] = await Promise.all([
      prisma.park.findMany({
        where: { identifier: { in: parkIds } },
        select: { identifier: true, timezone: true },
      }),
      userPrisma.pushSubscription.findMany({
        where: { userId: { in: userIds } },
      }),
      userPrisma.userPreferences.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, locale: true, timeFormat: true },
      }),
    ]);
    const tzByPark = new Map(parks.map((p) => [p.identifier, p.timezone]));
    const subsByUser = new Map<string, typeof subs>();
    for (const s of subs) {
      const list = subsByUser.get(s.userId) ?? [];
      list.push(s);
      subsByUser.set(s.userId, list);
    }
    const prefsByUser = new Map(prefs.map((p) => [p.userId, p]));

    // Regroupement par utilisateur (un seul push « digest » si plusieurs
    // représentations arrivent en même temps).
    const byUser = new Map<string, typeof toSend>();
    for (const r of toSend) {
      const list = byUser.get(r.userId) ?? [];
      list.push(r);
      byUser.set(r.userId, list);
    }

    const deadEndpoints: string[] = [];
    for (const [userId, reminders] of byUser) {
      const pref = prefsByUser.get(userId);
      const locale = pref?.locale ?? DEFAULT_LOCALE;
      const is12Hour = pref?.timeFormat === "h12";

      const items: ReminderShow[] = reminders.map((r) => {
        const tz = tzByPark.get(r.parkIdentifier) ?? "Europe/Paris";
        const timeLabel = DateTime.fromJSDate(r.startTime)
          .setZone(tz)
          .toFormat(is12Hour ? "h:mm a" : "HH:mm");
        return { show: r.showName, timeLabel, lead: r.leadMinutes };
      });

      const msg = buildShowReminderMessage(locale, items);
      const single = reminders.length === 1 ? reminders[0] : null;
      const payload: PushPayload = {
        title: msg.title,
        body: msg.body,
        url: `/${locale}/park/${reminders[0].parkIdentifier}`,
        tag: single ? `show-${single.id}` : "qp-show-reminders-digest",
      };

      const userSubs = subsByUser.get(userId) ?? [];
      let delivered = false;
      for (const s of userSubs) {
        const res = await sendPush(
          { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
          payload,
        );
        if (res.ok) delivered = true;
        else if (res.gone) deadEndpoints.push(s.endpoint);
      }

      if (delivered) summary.remindersSent++;
    }

    if (deadEndpoints.length > 0) {
      await userPrisma.pushSubscription.deleteMany({
        where: { endpoint: { in: deadEndpoints } },
      });
    }

    // Journal PERMANENT : on écrit un instantané pour chaque rappel parti (quoi
    // qu'il arrive, même sans abonnement valide), PUIS on supprime le
    // `ShowReminder` consommé. L'historique survit ainsi à toute édition /
    // suppression ultérieure d'un rappel, et n'est jamais purgé (le front borne
    // juste l'affichage à 30 j).
    await userPrisma.showReminderHistory.createMany({
      data: toSend.map((r) => ({
        userId: r.userId,
        parkIdentifier: r.parkIdentifier,
        parkName: r.parkName,
        showName: r.showName,
        startTime: r.startTime,
        leadMinutes: r.leadMinutes,
        sentAt: now,
      })),
    });
    await userPrisma.showReminder.deleteMany({
      where: { id: { in: toSend.map((r) => r.id) } },
    });
  }

  // Nettoyage : les rappels ENVOYÉS ont déjà été déplacés vers le journal
  // permanent puis supprimés (voir ci-dessus). Il ne reste à purger que les
  // rappels NON envoyés dont la représentation est déjà passée (manqués : le cron
  // a pris du retard) — sinon ils s'afficheraient à tort comme « actifs ».
  const purged = await userPrisma.showReminder.deleteMany({
    where: { startTime: { lt: now } },
  });
  summary.remindersPurged = purged.count;

  return summary;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPushConfigured()) {
    return NextResponse.json(
      { error: "VAPID keys not configured" },
      { status: 503 },
    );
  }

  const userPrisma = getUserPrisma();
  const prisma = getPrisma();
  const now = new Date();

  // Purge des alertes expirées depuis plus d'UNE SEMAINE. Une alerte ne vaut que
  // pour sa journée d'activation (`activeDate`) : désactivée le lendemain, elle
  // reste réactivable/modifiable quelques jours, puis est supprimée au bout d'une
  // semaine. `activeDate` est rafraîchi à chaque (ré)activation, donc une alerte
  // réactivée repart pour une semaine. Les anciennes lignes sans `activeDate`
  // (= sans expiration) sont ignorées. L'historique associé est conservé
  // (relation Alert→AlertHistory en `onDelete: SetNull`).
  const ALERT_RETENTION_DAYS = 7;
  const alertPurgeCutoff = new Date(
    now.getTime() - ALERT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const purgedAlerts = await userPrisma.alert.deleteMany({
    where: { activeDate: { lt: alertPurgeCutoff } },
  });

  // Passe « rappels de spectacles » (temporelle), indépendante des alertes de
  // seuil ci-dessous. Traitée en premier pour être exécutée même si l'app n'a
  // aucune alerte active.
  const reminderSummary = await processShowReminders(userPrisma, prisma);

  // 1. Toutes les alertes actives (tous utilisateurs confondus).
  const alerts = await userPrisma.alert.findMany({
    where: { active: true },
  });
  if (alerts.length === 0) {
    return NextResponse.json({
      checked: 0,
      sent: 0,
      purgedAlerts: purgedAlerts.count,
      ...reminderSummary,
    });
  }

  // 2. Temps d'attente RÉELS courants pour les attractions surveillées (file
  //    standby, enregistrement encore actif = endTime null). Base principale.
  const rideIds = [...new Set(alerts.map((a) => a.rideId))];
  const [waitRows, rides] = await Promise.all([
    prisma.waitTime.findMany({
      where: { rideId: { in: rideIds }, endTime: null, type: "standby" },
      select: { rideId: true, waitTime: true, status: true },
    }),
    // Fuseau du parc de chaque attraction : sert à évaluer « aujourd'hui » pour
    // l'expiration quotidienne des alertes (voir plus bas).
    prisma.ride.findMany({
      where: { id: { in: rideIds } },
      select: { id: true, park: { select: { timezone: true } } },
    }),
  ]);
  const waitByRide = new Map<number, { waitTime: number; status: string }>();
  for (const row of waitRows) {
    if (row.rideId != null) {
      waitByRide.set(row.rideId, {
        waitTime: row.waitTime,
        status: String(row.status),
      });
    }
  }
  const tzByRide = new Map<number, string>();
  for (const r of rides) tzByRide.set(r.id, r.park?.timezone ?? "Europe/Paris");

  // 3. Décision par alerte : à expirer (jour passé), à envoyer, à réarmer.
  const toFire: typeof alerts = [];
  const toRearm: string[] = [];
  const toExpire: string[] = [];
  for (const a of alerts) {
    // Expiration quotidienne : une alerte ne vaut que pour la journée où elle a
    // été activée. Si ce jour (dans le fuseau du parc) est passé, on la désactive
    // et on ne l'évalue plus (l'utilisateur a quitté le parc).
    if (a.activeDate) {
      const tz = tzByRide.get(a.rideId) ?? "Europe/Paris";
      const activeDay = DateTime.fromJSDate(a.activeDate).setZone(tz).toISODate();
      const today = DateTime.now().setZone(tz).toISODate();
      if (activeDay && today && activeDay < today) {
        toExpire.push(a.id);
        continue;
      }
    }

    const entry = waitByRide.get(a.rideId);
    const available = !!entry && entry.status === "open" && entry.waitTime >= 0;
    const inFireZone = available && entry!.waitTime <= a.threshold;
    const inRearmZone =
      available && entry!.waitTime > a.threshold + REARM_MARGIN;

    if (inFireZone && a.armed) {
      toFire.push(a);
    } else if (inRearmZone && !a.armed) {
      toRearm.push(a.id);
    }
  }

  // 4a. Expiration : désactivation des alertes des jours précédents.
  if (toExpire.length > 0) {
    await userPrisma.alert.updateMany({
      where: { id: { in: toExpire } },
      data: { active: false },
    });
  }

  // 4b. Réarmement (le temps est remonté au-dessus du seuil) : simple bascule.
  if (toRearm.length > 0) {
    await userPrisma.alert.updateMany({
      where: { id: { in: toRearm } },
      data: { armed: true },
    });
  }

  if (toFire.length === 0) {
    return NextResponse.json({
      checked: alerts.length,
      sent: 0,
      rearmed: toRearm.length,
      expired: toExpire.length,
      purgedAlerts: purgedAlerts.count,
      ...reminderSummary,
    });
  }

  // 5. Abonnements push + locale des utilisateurs concernés (une requête chacune).
  const userIds = [...new Set(toFire.map((a) => a.userId))];
  const [subs, prefs] = await Promise.all([
    userPrisma.pushSubscription.findMany({ where: { userId: { in: userIds } } }),
    userPrisma.userPreferences.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, locale: true },
    }),
  ]);
  const subsByUser = new Map<string, typeof subs>();
  for (const s of subs) {
    const list = subsByUser.get(s.userId) ?? [];
    list.push(s);
    subsByUser.set(s.userId, list);
  }
  const localeByUser = new Map(prefs.map((p) => [p.userId, p.locale]));

  // 6. Envoi + historique + désarmement. Best-effort : un envoi échoué ne bloque
  //    pas les autres ; un endpoint mort (410/404) est purgé.
  //
  // Regroupement PAR UTILISATEUR : si plusieurs attractions surveillées
  // descendent sous leur seuil dans le même passage, on envoie UNE notif « digest »
  // listée plutôt qu'une par attraction (pas de spam, même pour >10 alertes).
  // L'historique et le désarmement restent, eux, par alerte.
  const deadEndpoints: string[] = [];
  let sent = 0;

  const fireByUser = new Map<string, typeof toFire>();
  for (const a of toFire) {
    const list = fireByUser.get(a.userId) ?? [];
    list.push(a);
    fireByUser.set(a.userId, list);
  }

  for (const [userId, userAlerts] of fireByUser) {
    const userSubs = subsByUser.get(userId) ?? [];
    const locale = localeByUser.get(userId) ?? DEFAULT_LOCALE;

    const msg = buildAlertMessage(
      locale,
      userAlerts.map((a) => ({
        ride: a.rideName,
        wait: waitByRide.get(a.rideId)!.waitTime,
        threshold: a.threshold,
      })),
    );
    // Une seule attraction -> lien direct vers son parc et tag par attraction
    // (une nouvelle notif remplace la précédente). Plusieurs -> tag digest commun.
    const single = userAlerts.length === 1 ? userAlerts[0] : null;
    const payload: PushPayload = {
      title: msg.title,
      body: msg.body,
      url: `/${locale}/park/${(single ?? userAlerts[0]).parkIdentifier}`,
      tag: single ? `ride-${single.rideId}` : "qp-alerts-digest",
    };

    let delivered = false;
    for (const s of userSubs) {
      const res = await sendPush(
        { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
        payload,
      );
      if (res.ok) delivered = true;
      else if (res.gone) deadEndpoints.push(s.endpoint);
    }

    // Historique + désarmement PAR alerte, même si l'utilisateur n'a AUCUN
    // abonnement valide (il verra l'historique ; on n'insiste pas en boucle).
    for (const a of userAlerts) {
      const entry = waitByRide.get(a.rideId)!;
      await userPrisma.alertHistory.create({
        data: {
          userId: a.userId,
          alertId: a.id,
          rideId: a.rideId,
          rideName: a.rideName,
          parkIdentifier: a.parkIdentifier,
          threshold: a.threshold,
          actualWaitTime: entry.waitTime,
        },
      });
      // Objectif atteint : on considère l'alerte comme « réussie » et on la
      // DÉSACTIVE (au lieu de la désarmer). Ainsi, si le temps oscille autour du
      // seuil (10 → 15 → 20 …), on n'envoie PAS une notif à chaque passage : une
      // seule suffit. L'utilisateur peut la réactiver depuis son profil (la notif
      // le lui rappelle). `armed:false` par cohérence si elle est réactivée plus
      // tard sans repasser au-dessus du seuil.
      await userPrisma.alert.update({
        where: { id: a.id },
        data: { active: false, armed: false, lastAlertedAt: new Date() },
      });
    }
    if (delivered) sent++;
  }

  // 7. Purge des abonnements morts.
  if (deadEndpoints.length > 0) {
    await userPrisma.pushSubscription.deleteMany({
      where: { endpoint: { in: deadEndpoints } },
    });
  }

  return NextResponse.json({
    checked: alerts.length,
    fired: toFire.length,
    sent,
    rearmed: toRearm.length,
    expired: toExpire.length,
    purgedAlerts: purgedAlerts.count,
    prunedSubscriptions: deadEndpoints.length,
    ...reminderSummary,
  });
}
