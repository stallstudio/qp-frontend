// Récupération et reconstruction de l'historique des temps d'attente d'UNE
// attraction, à partir du modèle temporel `wait_times` (chaque changement d'état
// = une ligne startTime -> endTime, endTime = null pour l'état courant).
//
// Ce module concentre TOUT l'accès Prisma + la gestion du fuseau/horaires ; il
// alimente le module PUR `lib/wait-times-forecast.ts`. Séparation nette
// données / algorithme.

import { DateTime } from "luxon";
import { getPrisma } from "@/lib/prisma";
import { calculateParkDate, getOpeningHoursByParkAndDate } from "@/lib/opening-hours";
import type { DayIntervals, WaitInterval } from "@/lib/wait-times-forecast";
import { sliceIntervalsForWindow } from "@/lib/wait-times-forecast";

const DEFAULT_HISTORY_DAYS = 7;

// Types d'horaires ignorés pour délimiter la fenêtre d'exploitation (ils ne
// reflètent pas l'ouverture « normale » du parc au public).
const EXCLUDED_HOUR_TYPES = new Set(["private_event", "sold_out"]);

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
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

// Fenêtre d'exploitation d'un jour = enveloppe [min(openTime), max(closeTime)]
// sur les horaires « normaux ». openTime/closeTime étant des instants absolus,
// un parc nocturne (fermeture après minuit) donne naturellement close > open.
export function resolveDayWindow(
  hours: HourEntry[],
): { open: Date; close: Date } | null {
  let open: Date | null = null;
  let close: Date | null = null;
  for (const entry of hours) {
    if (EXCLUDED_HOUR_TYPES.has(entry.type)) continue;
    const o = toDate(entry.openTime);
    const c = toDate(entry.closeTime);
    if (o && (!open || o < open)) open = o;
    if (c && (!close || c > close)) close = c;
  }
  if (!open || !close || close.getTime() <= open.getTime()) return null;
  return { open, close };
}

// Intervalles standby d'une attraction chevauchant [fromUtc, toUtc). Le
// `OR endTime` capte l'intervalle actif au début de la fenêtre (attraction
// stable depuis la veille), sinon la courbe du matin serait vide.
export async function getRideStandbyIntervals(
  parkId: number,
  rideId: number,
  fromUtc: Date,
  toUtc: Date,
): Promise<WaitInterval[]> {
  const rows = await getPrisma().waitTime.findMany({
    where: {
      parkId,
      rideId,
      type: "standby",
      startTime: { lt: toUtc },
      OR: [{ endTime: null }, { endTime: { gte: fromUtc } }],
    },
    select: { waitTime: true, status: true, startTime: true, endTime: true },
    orderBy: { startTime: "asc" },
  });

  return rows.map((r) => ({
    start: r.startTime,
    end: r.endTime,
    waitTime: r.waitTime,
    status: r.status,
    available: r.status === "open" && r.waitTime >= 0,
  }));
}

// Orchestrateur : construit today + N jours précédents pour une attraction.
export async function buildRideHistory(
  parkId: number,
  timezone: string,
  rideId: number,
  opts?: { historyDays?: number },
): Promise<RideHistory> {
  const historyDays = opts?.historyDays ?? DEFAULT_HISTORY_DAYS;
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
  const todayWindow = resolveDayWindow(todayHours) ?? {
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
      select: { date: true, type: true, openTime: true, closeTime: true },
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
    const window = resolveDayWindow(hoursByDate.get(date) ?? []);
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
