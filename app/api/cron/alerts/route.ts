import { NextRequest, NextResponse } from "next/server";
import { DateTime } from "luxon";
import { getPrisma } from "@/lib/prisma";
import { getUserPrisma } from "@/lib/user-prisma";
import { isPushConfigured, sendPush, type PushPayload } from "@/lib/web-push";
import { buildAlertMessage } from "@/lib/alert-messages";

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

  // 1. Toutes les alertes actives (tous utilisateurs confondus).
  const alerts = await userPrisma.alert.findMany({
    where: { active: true },
  });
  if (alerts.length === 0) {
    return NextResponse.json({ checked: 0, sent: 0 });
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
  const deadEndpoints: string[] = [];
  let sent = 0;

  for (const a of toFire) {
    const entry = waitByRide.get(a.rideId)!;
    const userSubs = subsByUser.get(a.userId) ?? [];
    const locale = localeByUser.get(a.userId) ?? DEFAULT_LOCALE;
    const msg = buildAlertMessage(locale, {
      ride: a.rideName,
      wait: entry.waitTime,
      threshold: a.threshold,
      park: a.parkName,
    });
    const payload: PushPayload = {
      title: msg.title,
      body: msg.body,
      url: `/${locale}/park/${a.parkIdentifier}`,
      tag: `ride-${a.rideId}`,
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

    // On enregistre l'historique et on désarme même si l'utilisateur n'a AUCUN
    // abonnement valide (il verra l'historique ; on n'insiste pas en boucle).
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
    await userPrisma.alert.update({
      where: { id: a.id },
      data: { armed: false, lastAlertedAt: new Date() },
    });
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
    prunedSubscriptions: deadEndpoints.length,
  });
}
