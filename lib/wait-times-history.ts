// Récupération et reconstruction de l'historique des temps d'attente d'UNE
// attraction, à partir du modèle temporel `wait_times` (chaque changement d'état
// = une ligne startTime -> endTime, endTime = null pour l'état courant).
//
// Ce module concentre TOUT l'accès Prisma + la gestion du fuseau/horaires ; il
// alimente le module PUR `lib/wait-times-series.ts`. Séparation nette
// données / algorithme.

import { DateTime } from "luxon";
import { getPrisma } from "@/lib/prisma";
import { calculateParkDate, getOpeningHoursByParkAndDate } from "@/lib/opening-hours";
import type { DayIntervals, WaitInterval } from "@/lib/wait-times-series";
import { sliceIntervalsForWindow } from "@/lib/wait-times-series";

const DEFAULT_HISTORY_DAYS = 7;

// Types d'horaires ignorés pour délimiter la fenêtre d'exploitation (ils ne
// reflètent pas l'ouverture « normale » du parc au public).
// ⚠️ `event` en fait partie : une nocturne à billet séparé qui court jusqu'à 1 h
// du matin étirerait l'axe du graphique du jour de ~10 h à ~15 h d'amplitude, et
// écraserait toute la courbe d'une attraction de JOUR pour une session à
// laquelle elle ne participe même pas.
//
// ⚠️ **La réciproque est vraie, et c'est ce que gère `eventId` ci-dessous :** un
// maze de Halloween Horror Nights n'ouvre QUE pendant la nocturne. Lui appliquer
// la fenêtre de jour du parc (Universal Studios Florida : 09:00 – 17:00) donnait
// un graphique dont l'axe s'arrêtait à 17:00, soit une heure et demie AVANT que
// l'attraction n'ouvre — la courbe du soir et la prévision tombaient toutes deux
// hors champ. Un POI rattaché à un événement suit donc les horaires de SON
// événement (18:30 – 02:00), pas ceux du parc.
const EXCLUDED_HOUR_TYPES = new Set(["private_event", "sold_out", "event"]);

export type RideHistory = {
  timezone: string;
  now: Date;
  // Date logique du parc (YYYY-MM-DD), null si non calculable. Sert à valider
  // la fraîcheur de la prévision stockée.
  date: string | null;
  // null si aucune date logique exploitable (parc sans horaires connus).
  today: DayIntervals | null;
  // Jours précédents où le parc était ouvert (les jours fermés sont exclus).
  history: DayIntervals[];
};

type HourEntry = {
  type: string;
  openTime?: Date | string | null;
  closeTime?: Date | string | null;
  /** Événement saisonnier dont cette ligne est une session. */
  eventId?: number | null;
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

// Fenêtre d'exploitation d'un jour = enveloppe [min(openTime), max(closeTime)]
// sur les horaires « normaux ». openTime/closeTime étant des instants absolus,
// un parc nocturne (fermeture après minuit) donne naturellement close > open.
//
// `eventId` renseigné = fenêtre de CET événement : on ne retient alors que ses
// sessions, et le filtre par type ne s'applique pas — c'est justement une ligne
// `event` (ou `extension`) qu'on cherche. `null` (le cas courant) = fenêtre de
// jour du parc, sans les nocturnes.
export function resolveDayWindow(
  hours: HourEntry[],
  eventId: number | null = null,
): { open: Date; close: Date } | null {
  let open: Date | null = null;
  let close: Date | null = null;
  for (const entry of hours) {
    if (eventId != null) {
      if (entry.eventId !== eventId) continue;
    } else if (EXCLUDED_HOUR_TYPES.has(entry.type)) continue;
    const o = toDate(entry.openTime);
    const c = toDate(entry.closeTime);
    if (o && (!open || o < open)) open = o;
    if (c && (!close || c > close)) close = c;
  }
  if (!open || !close || close.getTime() <= open.getTime()) return null;
  return { open, close };
}

// Délai au-delà duquel un intervalle cesse d'être une OBSERVATION.
//
// ⚠️⚠️ **`wait_times` ne distingue pas « l'état n'a pas changé » de « on n'a pas
// regardé ».** Tant que l'état ne bouge pas, le worker ne fait que rafraîchir
// `lastSeenAt` ; si la collecte s'arrête, la ligne reste OUVERTE et sera clôturée
// à la REPRISE. La table affirme alors que la dernière valeur connue a tenu
// pendant tout le trou. Sans cette borne, la courbe « observée » du jour trace
// une ligne parfaitement plate sur des heures où personne n'a rien mesuré —
// mesuré au Parc du Petit Prince : « 35 min » du 2026-08-30 12:09 au 31 à 14:01,
// soit 25,8 h, dont la moitié de deux journées d'ouverture.
//
// 15 min : l'écart entre deux passages est à 98,3 % inférieur à 2 min (397 529
// intervalles clos relevés du 2026-08-25 au 09-01) ; la valeur absorbe les
// ratés ponctuels sans jamais couvrir un vrai trou. ⚠️ Doit rester alignée sur
// `COLLECTION_TOLERANCE_MINUTES` du worker (`services/forecast/forecastData.ts`),
// qui borne le même historique pour la PRÉVISION : deux valeurs différentes
// feraient diverger la courbe observée de la courbe prévue sur les mêmes heures.
const COLLECTION_TOLERANCE_MS = 15 * 60_000;

// Intervalles standby d'une attraction chevauchant [fromUtc, toUtc). Le
// `OR endTime` capte l'intervalle actif au début de la fenêtre (attraction
// stable depuis la veille), sinon la courbe du matin serait vide.
//
// Chaque intervalle est borné à sa dernière confirmation (`lastSeenAt`) : ce
// qui sort d'ici n'est pas ce que la table AFFIRME, c'est ce qui a été observé.
export async function getRideStandbyIntervals(
  parkId: number,
  rideId: number,
  fromUtc: Date,
  toUtc: Date,
): Promise<WaitInterval[]> {
  const rows = await getPrisma().waitTime.findMany({
    where: {
      parkId,
      poiId: rideId,
      type: "standby",
      startTime: { lt: toUtc },
      OR: [{ endTime: null }, { endTime: { gte: fromUtc } }],
    },
    select: {
      waitTime: true,
      status: true,
      startTime: true,
      endTime: true,
      lastSeenAt: true,
    },
    orderBy: { startTime: "asc" },
  });

  const intervals: WaitInterval[] = [];
  for (const r of rows) {
    let end = r.endTime;
    const confirmedUntil = r.lastSeenAt.getTime() + COLLECTION_TOLERANCE_MS;
    const endMs = end ? end.getTime() : Infinity;
    if (confirmedUntil < endMs) {
      if (end === null && confirmedUntil >= toUtc.getTime()) {
        // État courant, confirmé jusqu'au bout de la fenêtre : il n'a pas de
        // fin, et lui en donner une couperait la dernière mesure de la courbe.
        end = null;
      } else {
        if (confirmedUntil <= fromUtc.getTime()) continue;
        end = new Date(confirmedUntil);
      }
    }
    if (end !== null && end.getTime() <= r.startTime.getTime()) continue;

    intervals.push({
      start: r.startTime,
      end,
      waitTime: r.waitTime,
      status: r.status,
      available: r.status === "open" && r.waitTime >= 0,
    });
  }
  return intervals;
}

// Orchestrateur : construit today + N jours précédents pour une attraction.
//
// `eventId` = l'événement auquel l'attraction est rattachée (`pois.eventId`),
// quand elle l'est. Il ne change qu'une chose, mais elle est décisive : les
// fenêtres de journée sont alors celles de l'ÉVÉNEMENT et non du parc.
export async function buildRideHistory(
  parkId: number,
  timezone: string,
  rideId: number,
  opts?: { historyDays?: number; eventId?: number | null },
): Promise<RideHistory> {
  const historyDays = opts?.historyDays ?? DEFAULT_HISTORY_DAYS;
  const eventId = opts?.eventId ?? null;
  const now = new Date();

  const todayISO = await calculateParkDate(parkId, timezone);
  if (!todayISO) {
    return { timezone, now, date: null, today: null, history: [] };
  }

  const dayStart = DateTime.fromISO(todayISO, { zone: timezone })
    .startOf("day")
    .toUTC()
    .toJSDate();

  // Aujourd'hui : intervalles jusqu'à maintenant + fenêtre d'ouverture.
  const todayIntervals = await getRideStandbyIntervals(
    parkId,
    rideId,
    dayStart,
    now,
  );
  const todayHours = await getOpeningHoursByParkAndDate(parkId, todayISO);
  // ⚠️ Repli sur la fenêtre du PARC quand l'événement n'a pas de session
  // publiée aujourd'hui, et non sur « rien » : un parc peut très bien faire
  // tourner ses mazes sans jamais publier d'horaires de nocturne (c'est
  // exactement ce que `ParkEvent.startDate/endDate` existe pour rattraper). On
  // retombe alors sur le comportement d'avant, qui vaut mieux qu'un graphique
  // vide.
  const todayWindow = (eventId != null
    ? resolveDayWindow(todayHours, eventId)
    : null) ??
    resolveDayWindow(todayHours) ?? {
      // Sans horaires connus : on borne à [dayStart, maintenant] pour tracer au
      // moins l'observé (la stratégie ne produira alors pas de prévision).
      open: dayStart,
      close: now,
    };

  const today: DayIntervals = {
    open: todayWindow.open,
    close: todayWindow.close,
    intervals: todayIntervals,
  };

  // La prévision étant précalculée par le worker, l'appelant demande souvent
  // `historyDays: 0` (courbe du jour uniquement). On sort AVANT les deux
  // requêtes d'historique, qui ne renverraient rien de toute façon.
  if (historyDays <= 0) {
    return { timezone, now, date: todayISO, today, history: [] };
  }

  // Jours précédents : une seule requête d'intervalles + une seule requête
  // d'horaires, puis regroupement par jour côté JS.
  const windowStart = DateTime.fromISO(todayISO, { zone: timezone })
    .minus({ days: historyDays })
    .startOf("day")
    .toUTC()
    .toJSDate();

  const prevDates: string[] = [];
  for (let i = 1; i <= historyDays; i++) {
    const iso = DateTime.fromISO(todayISO, { zone: timezone })
      .minus({ days: i })
      .toISODate();
    if (iso) prevDates.push(iso);
  }

  const [historyIntervals, prevHourRows] = await Promise.all([
    getRideStandbyIntervals(parkId, rideId, windowStart, dayStart),
    getPrisma().openingHours.findMany({
      where: { parkId, date: { in: prevDates } },
      select: {
        date: true,
        type: true,
        openTime: true,
        closeTime: true,
        eventId: true,
      },
    }),
  ]);

  const hoursByDate = new Map<string, HourEntry[]>();
  for (const row of prevHourRows) {
    const list = hoursByDate.get(row.date) ?? [];
    list.push(row);
    hoursByDate.set(row.date, list);
  }

  const history: DayIntervals[] = [];
  for (const date of prevDates) {
    // ⚠️ Pour un POI d'événement, PAS de repli sur la fenêtre du parc ici : un
    // jour sans session est un jour où l'événement ne tournait pas, et le
    // compter reviendrait à verser une journée entière de « fermé » dans un
    // profil censé décrire des soirées.
    const window = resolveDayWindow(hoursByDate.get(date) ?? [], eventId);
    if (!window) continue; // parc fermé ce jour-là : exclu du profil moyen.
    const intervals = sliceIntervalsForWindow(
      historyIntervals,
      window.open,
      window.close,
    );
    if (intervals.length > 0) {
      history.push({ open: window.open, close: window.close, intervals });
    }
  }

  return { timezone, now, date: todayISO, today, history };
}
