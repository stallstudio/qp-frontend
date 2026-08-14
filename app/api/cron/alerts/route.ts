import { NextRequest, NextResponse } from "next/server";
import { DateTime } from "luxon";
import { getPrisma } from "@/lib/prisma";
import { getUserPrisma } from "@/lib/user-prisma";
import { purgeOldRequestLogs } from "@/lib/api-request-log";
import { isPushConfigured, sendPush, type PushPayload } from "@/lib/web-push";
import {
  buildAlertMessage,
  buildReopenMessage,
  buildReopenRearmMessage,
} from "@/lib/alert-messages";
import { rideSlug } from "@/lib/slug";
import {
  reopenAllowedForWindow,
  REOPEN_REARM_CLOSING_MARGIN_MS,
} from "@/lib/park-closing";
import { loadParkOpenWindows } from "@/lib/park-closing-db";
import {
  buildShowReminderMessage,
  type ReminderShow,
} from "@/lib/show-reminder-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ————————————————————————————————————————————————————————————————————————
// MOTEUR D'ALERTES (déclenché ~toutes les 1-2 min par une Dokploy Schedule, comme
// le fetch des temps du worker). Il traite DEUX natures d'alerte, selon l'état de
// l'attraction au moment où l'utilisateur l'a posée :
//   • SEUIL (`threshold`, attraction ouverte) — compare le temps d'attente RÉEL
//     au seuil et envoie un push quand il DESCEND à ≤ seuil ;
//   • RÉOUVERTURE (`reopen`, attraction à l'arrêt) — envoie un push dès que
//     l'attraction repasse à `open`. Voir REOPEN_REARM_WINDOW_MS plus bas.
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

// ————————————————————————— Alertes de RÉOUVERTURE —————————————————————————
// Seconde nature d'alerte (voir l'enum AlertType du schéma) : l'attraction est à
// l'arrêt, il n'y a aucun temps d'attente à surveiller, et la seule nouvelle
// utile est sa remise en service.
//
// Cycle de vie, volontairement différent de celui d'une alerte de seuil :
//   • une alerte de seuil qui notifie est SUPPRIMÉE (son objectif est atteint) ;
//   • une alerte de réouverture qui notifie est seulement DÉSACTIVÉE, et sa ligne
//     survit jusqu'à la fin de la journée. Sans cette ligne, le réarmement
//     automatique ci-dessous n'aurait plus rien à réarmer.
//
// Réarmement automatique : une attraction tout juste réparée peut retomber en
// panne dans la foulée. Dans ce cas on remet l'alerte en veille TOUT SEUL et on
// le dit à l'utilisateur — sinon il croit son attraction ouverte alors qu'elle
// ne l'est plus, et devrait recréer son alerte sans même savoir qu'il le doit.
// Au-delà de cette fenêtre, on ne touche à rien : une panne survenue une heure
// après la réouverture est un ÉVÉNEMENT NOUVEAU, pas la suite du précédent, et
// c'est à l'utilisateur de décider s'il attend encore cette attraction.
const REOPEN_REARM_WINDOW_MS = 60 * 60_000;

// Statuts qui déclenchent le réarmement automatique. `closed` en est
// délibérément ABSENT : à la fermeture du parc, TOUTES les attractions y
// passent. Sans cette exclusion, quiconque a reçu une notification de
// réouverture dans la dernière heure d'ouverture recevrait, chaque soir, un
// « c'est de nouveau à l'arrêt » qui ne décrit aucune panne.
//
// ⚠️ Cette liste NE SUFFIT PAS. Selon les parcs, une attraction qui s'arrête
// pour la nuit reste en `down` ou en `maintenance` — donc dans cette liste. Le
// statut seul ne permet pas de séparer la panne de la fin de journée : c'est
// l'HORAIRE DU PARC qui tranche, via `lib/park-closing.ts` (voir plus bas).
const REOPEN_REARM_STATUSES = new Set(["down", "maintenance"]);

// ——————————————————————— Verrou anti-chevauchement ———————————————————————
// La Schedule déclenche cette route toutes les 1-2 min, mais un passage peut
// durer plus longtemps (les envois push sont séquentiels : un par abonnement et
// par utilisateur). Sans verrou, deux exécutions se chevauchent et, comme on
// ENVOIE avant de désarmer / supprimer, la même alerte part deux fois.
//
// Verrou EN MÉMOIRE (l'app tourne dans un seul conteneur). S'il fallait un jour
// passer à plusieurs instances, c'est ici qu'un verrou partagé s'imposerait.
const MAX_RUN_MS = 5 * 60_000;

const globalForCron = globalThis as unknown as {
  alertsCronStartedAt: number | null | undefined;
};

// Renvoie `false` si un passage est déjà en cours. Un verrou plus vieux que
// MAX_RUN_MS est considéré comme abandonné (processus tué en plein run) et
// repris, plutôt que de bloquer les alertes indéfiniment.
function acquireRunLock(): boolean {
  const startedAt = globalForCron.alertsCronStartedAt;
  if (startedAt != null && Date.now() - startedAt < MAX_RUN_MS) return false;
  globalForCron.alertsCronStartedAt = Date.now();
  return true;
}

function releaseRunLock(): void {
  globalForCron.alertsCronStartedAt = null;
}

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
        // Les spectacles n'ont pas de page dédiée : on ouvre la page du parc
        // directement sur l'onglet Spectacles, sans quoi l'utilisateur atterrit
        // sur les temps d'attente et doit changer d'onglet lui-même.
        url: `/${locale}/park/${reminders[0].parkIdentifier}?tab=shows`,
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

  if (!acquireRunLock()) {
    // 200 et non 409 : ce n'est pas une erreur, juste un passage sauté. La
    // Schedule ne doit pas être alertée pour ça.
    return NextResponse.json({ skipped: true, reason: "already running" });
  }

  try {
    return await runAlertsPass();
  } finally {
    releaseRunLock();
  }
}

async function runAlertsPass(): Promise<NextResponse> {
  const userPrisma = getUserPrisma();
  const prisma = getPrisma();
  const now = new Date();

  // Filet de sécurité : les alertes ACTIVES sont désormais supprimées dès que
  // leur journée est passée dans le fuseau du parc (voir plus bas), et une alerte
  // qui notifie est supprimée aussitôt. Ne peuvent donc traîner ici que des
  // lignes DÉSACTIVÉES d'anciennes versions, que la boucle d'expiration ne voit
  // pas (elle ne lit que les actives) : on les balaie au bout d'une semaine. Les
  // lignes sans `activeDate` (= sans expiration) sont ignorées. L'historique
  // associé survit (relation Alert→AlertHistory en `onDelete: SetNull`).
  const ALERT_RETENTION_DAYS = 7;
  const alertPurgeCutoff = new Date(
    now.getTime() - ALERT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const purgedAlerts = await userPrisma.alert.deleteMany({
    where: { activeDate: { lt: alertPurgeCutoff } },
  });

  // Entretien du journal de consultations (base principale) : la table
  // grossissait sans limite alors que seules les 2 dernières heures servent au
  // classement des parcs populaires. Ce cron tournant déjà en continu, il évite
  // une planification dédiée. Par lots, pour ne pas verrouiller la table.
  const purgedRequestLogs = await purgeOldRequestLogs();

  // Passe « rappels de spectacles » (temporelle), indépendante des alertes de
  // seuil ci-dessous. Traitée en premier pour être exécutée même si l'app n'a
  // aucune alerte active.
  const reminderSummary = await processShowReminders(userPrisma, prisma);

  // 1. Toutes les alertes, ACTIVES ET NON ACTIVES (tous utilisateurs confondus).
  //
  // ⚠️ On ne filtre PLUS sur `active: true`. Une alerte de réouverture déjà
  // notifiée reste en base jusqu'au soir (voir REOPEN_REARM_WINDOW_MS) : c'est
  // précisément une ligne inactive, et il faut la relire à chaque passage pour
  // pouvoir la réarmer — et pour l'expirer en fin de journée comme les autres.
  const alerts = await userPrisma.alert.findMany();
  if (alerts.length === 0) {
    return NextResponse.json({
      checked: 0,
      sent: 0,
      purgedAlerts: purgedAlerts.count,
      purgedRequestLogs,
      ...reminderSummary,
    });
  }

  // 2. Temps d'attente RÉELS courants pour les attractions surveillées (file
  //    standby, enregistrement encore actif = endTime null). Base principale.
  const rideIds = [...new Set(alerts.map((a) => a.rideId))];
  const [waitRows, rides] = await Promise.all([
    prisma.waitTime.findMany({
      where: { rideId: { in: rideIds }, endTime: null, type: "standby" },
      // `startTime` : la table est une table d'INTERVALLES et le statut fait
      // partie de la signature d'un intervalle (stateHash côté worker). Le
      // `startTime` de l'intervalle ouvert est donc l'instant EXACT où
      // l'attraction est entrée dans son état courant — c'est ce qui permet de
      // dater une panne sans conserver d'historique de notre côté.
      select: { rideId: true, waitTime: true, status: true, startTime: true },
    }),
    // Parc de chaque attraction : son FUSEAU sert à évaluer « aujourd'hui » pour
    // l'expiration quotidienne, et son IDENTIFIANT à retrouver son horaire de
    // fermeture (réarmement des alertes de réouverture).
    prisma.ride.findMany({
      where: { id: { in: rideIds } },
      select: { id: true, park: { select: { id: true, timezone: true } } },
    }),
  ]);
  const waitByRide = new Map<
    number,
    { waitTime: number; status: string; startTime: Date }
  >();
  for (const row of waitRows) {
    if (row.rideId != null) {
      waitByRide.set(row.rideId, {
        waitTime: row.waitTime,
        status: String(row.status),
        startTime: row.startTime,
      });
    }
  }
  const tzByRide = new Map<number, string>();
  const parkIdByRide = new Map<number, number>();
  for (const r of rides) {
    tzByRide.set(r.id, r.park?.timezone ?? "Europe/Paris");
    if (r.park) parkIdByRide.set(r.id, r.park.id);
  }

  // Horaires d'ouverture des parcs concernés, UNIQUEMENT si des alertes de
  // réouverture déjà notifiées attendent un éventuel réarmement. Aucune alerte
  // de ce type en attente = aucune requête (le cas courant : ce cron tourne
  // toutes les 1-2 min, pour rien la plupart du temps).
  const rearmCandidateParkIds = [
    ...new Set(
      alerts
        .filter((a) => a.type === "reopen" && !a.active)
        .map((a) => parkIdByRide.get(a.rideId))
        .filter((id): id is number => id != null),
    ),
  ];
  const parkWindows =
    rearmCandidateParkIds.length > 0
      ? await loadParkOpenWindows(rearmCandidateParkIds, now)
      : new Map();

  // 3. Décision par alerte : à expirer (jour passé), à envoyer, à réarmer.
  //
  // Cinq issues possibles, jamais cumulables sur un même passage :
  //   toExpire       — la journée du parc est passée : suppression, tous types.
  //   toFire         — alerte de SEUIL : le temps est descendu à ≤ seuil.
  //   toRearm        — alerte de SEUIL : le temps est remonté, on réarme.
  //   toReopen       — alerte de RÉOUVERTURE : l'attraction vient de rouvrir.
  //   toReopenRearm  — alerte de RÉOUVERTURE déjà notifiée : rechute dans l'heure.
  const toFire: typeof alerts = [];
  const toRearm: string[] = [];
  const toExpire: string[] = [];
  const toReopen: typeof alerts = [];
  const toReopenRearm: typeof alerts = [];
  for (const a of alerts) {
    // Expiration quotidienne : une alerte ne vaut que pour la journée où elle a
    // été activée. Passé MINUIT DANS LE FUSEAU DU PARC (pas celui du serveur ni
    // celui de l'utilisateur : c'est la journée sur place qui compte), elle est
    // SUPPRIMÉE — l'utilisateur a quitté le parc, et le profil ne propose plus de
    // la réactiver. Une alerte qui traîne n'aurait donc plus qu'un seul effet
    // possible : notifier pour une visite qui n'a pas lieu.
    //
    // S'applique AUSSI aux alertes déjà consommées (une réouverture notifiée
    // reste en base jusqu'au soir), d'où le test avant tout aiguillage par type.
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

    // ————————————————————————— Alertes de RÉOUVERTURE —————————————————————————
    if (a.type === "reopen") {
      if (!entry) continue;

      if (a.active && a.armed) {
        // Tout `open` observé EST la réouverture attendue : la route de création
        // refuse de poser ce type d'alerte sur une attraction déjà ouverte, donc
        // l'alerte n'a pu naître que sur un état à l'arrêt. Pas besoin d'exiger
        // un temps d'attente exploitable ici — une attraction qui rouvre sans
        // publier d'attente (waitTime -1) a quand même rouvert.
        if (entry.status === "open") toReopen.push(a);
        continue;
      }

      // Déjà notifiée (inactive) : rechute dans l'heure -> on réarme seul.
      // La panne doit être POSTÉRIEURE à notre notification (sinon on relirait
      // l'état d'avant la réouverture) et tomber dans la fenêtre.
      if (!a.active && a.lastAlertedAt && REOPEN_REARM_STATUSES.has(entry.status)) {
        const since = entry.startTime.getTime() - a.lastAlertedAt.getTime();
        if (since <= 0 || since > REOPEN_REARM_WINDOW_MS) continue;

        // …et le parc ne doit pas être sur le point de fermer : à cette heure-là,
        // un `down` / `maintenance` est une mise en sommeil, pas une panne.
        const parkId = parkIdByRide.get(a.rideId);
        if (
          !reopenAllowedForWindow(
            parkId != null ? parkWindows.get(parkId) : undefined,
            now,
            REOPEN_REARM_CLOSING_MARGIN_MS,
          )
        ) {
          continue;
        }

        toReopenRearm.push(a);
      }
      continue;
    }

    // ————————————————————————————— Alertes de SEUIL —————————————————————————————
    // Une alerte de seuil qui notifie est supprimée : seules les actives peuvent
    // encore se déclencher, et `threshold` est renseigné pour ce type.
    if (!a.active || a.threshold == null) continue;

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

  // 4a. Expiration : suppression des alertes dont la journée est passée dans le
  //     parc, ACTIVES OU NON. Rien à journaliser au passage : soit l'alerte n'a
  //     jamais notifié, soit elle l'a déjà fait et son entrée d'historique
  //     existe — celle-ci survit à la suppression (`onDelete: SetNull`).
  if (toExpire.length > 0) {
    await userPrisma.alert.deleteMany({
      where: { id: { in: toExpire } },
    });
  }

  // 4b. Réarmement (le temps est remonté au-dessus du seuil) : simple bascule.
  if (toRearm.length > 0) {
    await userPrisma.alert.updateMany({
      where: { id: { in: toRearm } },
      data: { armed: true },
    });
  }

  if (
    toFire.length === 0 &&
    toReopen.length === 0 &&
    toReopenRearm.length === 0
  ) {
    return NextResponse.json({
      checked: alerts.length,
      sent: 0,
      rearmed: toRearm.length,
      expired: toExpire.length,
      purgedAlerts: purgedAlerts.count,
      purgedRequestLogs,
      ...reminderSummary,
    });
  }

  // 5. Abonnements push + locale des utilisateurs concernés (une requête chacune).
  //    Chargés pour les TROIS familles d'envoi d'un coup : un même utilisateur
  //    peut très bien être concerné par plusieurs dans le même passage.
  const userIds = [
    ...new Set(
      [...toFire, ...toReopen, ...toReopenRearm].map((a) => a.userId),
    ),
  ];
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

  // Les trois familles d'envoi partagent le même regroupement par utilisateur et
  // le même acheminement ; seul le message diffère. Deux petites aides évitent de
  // recopier trois fois la boucle d'abonnements (et d'oublier, dans l'une d'elles,
  // la collecte des endpoints morts).
  const groupByUser = <T extends { userId: string }>(items: T[]) => {
    const map = new Map<string, T[]>();
    for (const it of items) {
      const list = map.get(it.userId) ?? [];
      list.push(it);
      map.set(it.userId, list);
    }
    return map;
  };

  // Envoie à TOUS les appareils de l'utilisateur. Renvoie true si au moins un
  // appareil a reçu la notification (sert au compteur `sent`).
  const deliver = async (userId: string, payload: PushPayload) => {
    let delivered = false;
    for (const s of subsByUser.get(userId) ?? []) {
      const res = await sendPush(
        { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
        payload,
      );
      if (res.ok) delivered = true;
      else if (res.gone) deadEndpoints.push(s.endpoint);
    }
    return delivered;
  };

  const fireByUser = groupByUser(toFire);

  for (const [userId, userAlerts] of fireByUser) {
    const locale = localeByUser.get(userId) ?? DEFAULT_LOCALE;

    const msg = buildAlertMessage(
      locale,
      userAlerts.map((a) => ({
        ride: a.rideName,
        wait: waitByRide.get(a.rideId)!.waitTime,
        // Non nul par construction : la boucle de décision écarte les alertes de
        // seuil sans seuil (ce sont les alertes de réouverture).
        threshold: a.threshold!,
      })),
    );
    // Une seule attraction -> lien profond vers SA page (l'utilisateur voit
    // immédiatement le temps d'attente, le graphique et son alerte, sans avoir à
    // retrouver la ligne dans la liste du parc) et tag par attraction (une
    // nouvelle notif remplace la précédente). Plusieurs -> page du parc, qui les
    // regroupe toutes, et tag digest commun.
    const single = userAlerts.length === 1 ? userAlerts[0] : null;
    const payload: PushPayload = {
      title: msg.title,
      body: msg.body,
      url: single
        ? `/${locale}/park/${single.parkIdentifier}/ride/${rideSlug(
            single.rideId,
            single.rideName,
          )}`
        : `/${locale}/park/${userAlerts[0].parkIdentifier}`,
      tag: single ? `ride-${single.rideId}` : "qp-alerts-digest",
    };

    const delivered = await deliver(userId, payload);

    // Journal PERMANENT puis SUPPRESSION de l'alerte consommée, même si
    // l'utilisateur n'a AUCUN abonnement valide (il verra l'historique ; on
    // n'insiste pas en boucle). Une alerte est à usage unique : son objectif est
    // atteint, la garder désactivée n'aurait servi qu'à la réactiver depuis le
    // profil — ce que le profil ne propose plus (tout se règle depuis la page du
    // parc). Ça règle aussi le cas du temps qui oscille autour du seuil
    // (10 → 15 → 20 …) : plus d'alerte, donc plus de notification répétée.
    // L'historique survit à la suppression (relation en `onDelete: SetNull`).
    for (const a of userAlerts) {
      const entry = waitByRide.get(a.rideId)!;
      await userPrisma.alertHistory.create({
        data: {
          userId: a.userId,
          alertId: a.id,
          rideId: a.rideId,
          rideName: a.rideName,
          parkIdentifier: a.parkIdentifier,
          type: "threshold",
          threshold: a.threshold,
          actualWaitTime: entry.waitTime,
        },
      });
      await userPrisma.alert.delete({ where: { id: a.id } });
    }
    if (delivered) sent++;
  }

  // 6b. RÉOUVERTURES : « ton attraction vient de rouvrir ».
  //
  // Différence essentielle avec une alerte de seuil : la ligne n'est PAS
  // supprimée, seulement désactivée. Elle doit survivre pour que la rechute
  // éventuelle (bloc 6c) trouve encore quelque chose à réarmer. C'est
  // l'expiration quotidienne (bloc 4a) qui la balaiera le soir venu, exactement
  // comme les autres.
  let reopenSent = 0;
  for (const [userId, userAlerts] of groupByUser(toReopen)) {
    const locale = localeByUser.get(userId) ?? DEFAULT_LOCALE;
    const msg = buildReopenMessage(
      locale,
      userAlerts.map((a) => a.rideName),
    );
    const single = userAlerts.length === 1 ? userAlerts[0] : null;
    const payload: PushPayload = {
      title: msg.title,
      body: msg.body,
      url: single
        ? `/${locale}/park/${single.parkIdentifier}/ride/${rideSlug(
            single.rideId,
            single.rideName,
          )}`
        : `/${locale}/park/${userAlerts[0].parkIdentifier}`,
      // Tag distinct de celui des alertes de seuil : les deux natures ne peuvent
      // pas coexister sur une attraction, mais elles se SUCCÈDENT dans la même
      // journée (une réouverture peut être suivie d'une alerte de seuil posée
      // dans la foulée). Un tag commun ferait disparaître la première.
      tag: single ? `reopen-${single.rideId}` : "qp-reopen-digest",
    };

    const delivered = await deliver(userId, payload);

    for (const a of userAlerts) {
      const entry = waitByRide.get(a.rideId)!;
      await userPrisma.alertHistory.create({
        data: {
          userId: a.userId,
          alertId: a.id,
          rideId: a.rideId,
          rideName: a.rideName,
          parkIdentifier: a.parkIdentifier,
          type: "reopen",
          threshold: null,
          // Le temps publié à la réouverture, tel quel : -1 (« pas d'attente
          // communiquée ») est une information honnête, pas une valeur à masquer.
          actualWaitTime: entry.waitTime,
        },
      });
      await userPrisma.alert.update({
        where: { id: a.id },
        data: { active: false, armed: false, lastAlertedAt: now },
      });
    }
    if (delivered) reopenSent++;
  }

  // 6c. RECHUTES : l'attraction est retombée à l'arrêt dans l'heure suivant sa
  //     réouverture. On réarme l'alerte SANS que l'utilisateur ait à y penser, et
  //     on le lui dit — la notification précédente lui annonçait l'inverse.
  let reopenRearmed = 0;
  for (const [userId, userAlerts] of groupByUser(toReopenRearm)) {
    const locale = localeByUser.get(userId) ?? DEFAULT_LOCALE;
    const msg = buildReopenRearmMessage(
      locale,
      userAlerts.map((a) => a.rideName),
    );
    const single = userAlerts.length === 1 ? userAlerts[0] : null;
    const payload: PushPayload = {
      title: msg.title,
      body: msg.body,
      url: single
        ? `/${locale}/park/${single.parkIdentifier}/ride/${rideSlug(
            single.rideId,
            single.rideName,
          )}`
        : `/${locale}/park/${userAlerts[0].parkIdentifier}`,
      tag: single ? `reopen-${single.rideId}` : "qp-reopen-digest",
    };

    await deliver(userId, payload);

    // Pas d'entrée d'historique ici : le journal recense les alertes REMPLIES,
    // et celle-ci ne l'est pas — elle repart en veille. `activeDate` n'est pas
    // recalé non plus : la réactivation est automatique, elle ne doit pas
    // prolonger la validité de l'alerte au-delà de la journée d'origine.
    await userPrisma.alert.updateMany({
      where: { id: { in: userAlerts.map((a) => a.id) } },
      data: { active: true, armed: true },
    });
    reopenRearmed += userAlerts.length;
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
    reopened: toReopen.length,
    reopenSent,
    reopenRearmed,
    purgedAlerts: purgedAlerts.count,
    purgedRequestLogs,
    prunedSubscriptions: deadEndpoints.length,
    ...reminderSummary,
  });
}
