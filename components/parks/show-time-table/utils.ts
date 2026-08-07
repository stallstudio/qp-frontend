import { ShowTime, ShowSchedule } from "@/types/show";
import { DateTime } from "luxon";
import { ScheduleWithPosition } from "./types";

// Durée en toutes lettres, localisée : « 34 minutes », « 1 heure »,
// « 2 heures 30 minutes ». `Intl.NumberFormat` (style unit, unitDisplay long)
// gère nativement l'espace, le mot complet ET le pluriel dans chaque langue.
export function formatDuration(minutes: number, locale: string): string {
  const unit = (value: number, name: "hour" | "minute") =>
    new Intl.NumberFormat(locale, {
      style: "unit",
      unit: name,
      unitDisplay: "long",
    }).format(value);

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(unit(hours, "hour"));
  if (remainingMinutes > 0 || hours === 0) {
    parts.push(unit(remainingMinutes, "minute"));
  }
  return parts.join(" ");
}

// ————————————————————————— Accès continu —————————————————————————
// Certaines « attractions-spectacles » (ex. Puy du Fou : Les Amoureux de Verdun,
// Le Mystère de La Pérouse) ne sont pas des représentations à heure fixe mais des
// ACCÈS CONTINUS : la source donne un unique créneau couvrant toute la plage
// d'ouverture (ex. 12:00 → 20:15), et le champ `duration` (15/20 min) est la durée
// de VISITE, pas un horaire. Afficher « Durée : 20 min » induit en erreur — on
// veut montrer la plage d'accès. On détecte ce cas par un créneau dont l'amplitude
// dépasse largement la durée de visite.
const CONTINUOUS_MIN_SPAN_MIN = 120;
const CONTINUOUS_SPAN_RATIO = 3;

// ————————————————————— Deuxième porte d'entrée —————————————————————
// ⚠️ Le test du ratio ci-dessus ne peut PAS voir le cas inverse, et c'est
// structurel. Il suppose une durée de visite COURTE dans un créneau long
// (Puy du Fou : 20 min dans 8 h, ratio 24). Miral fait l'inverse : il annonce
// toute la plage d'accès comme durée. Yas Waterworld, mesuré le 2026-08-07 :
//
//   Yas Ladies Day   duration 540 min, créneau 09:00 → 18:00 (540 min)
//   Yas Ladies Night duration 240 min, créneau 13:00 → 17:00 (240 min)
//
// L'amplitude vaut alors exactement la durée, donc `span >= 3 * duration` est
// faux — et il l'est d'autant plus que le cas est évident. « Yas Ladies Day »
// s'affichait « Durée : 9 heures », ce qui ne décrit aucun spectacle.
//
// La seconde règle prend le problème par l'autre bout : une durée ÉGALE à
// l'amplitude, sur une plage assez longue, est une plage d'accès et non une
// représentation. Aucun spectacle ne dure quatre heures.
//
// ⚠️ **Le seuil est à 240 min, pas à `CONTINUOUS_MIN_SPAN_MIN`**, sinon la
// règle happerait de vraies représentations longues. Vérifié sur la base
// entière : à 240 min elle ne retient QUE les deux créneaux de Yas Waterworld.
// Les jeux Fantawild de Huaian (`duration` 265 min pour une amplitude moyenne
// de 160) sont écartés par la tolérance ; 丝路盛景 (150 min, amplitude 150)
// reste sous le seuil et garde son affichage en durée.
const CONTINUOUS_LONG_SPAN_MIN = 240;
// La durée annoncée et l'amplitude ne coïncident pas toujours à la minute :
// arrondis de la source, fin de créneau décalée.
const CONTINUOUS_SPAN_TOLERANCE_MIN = 15;

export type ShowAccessInfo =
  | { kind: "duration"; minutes: number }
  | { kind: "continuous"; startTime: string; endTime: string };

// Amplitude (min) d'un créneau si sa fin est connue et postérieure au début.
function getSlotSpanMinutes(
  schedule: ShowSchedule,
  timezone: string,
): number | null {
  if (!schedule.endTime) return null;
  const start = DateTime.fromISO(schedule.startTime, { zone: timezone });
  const end = DateTime.fromISO(schedule.endTime, { zone: timezone });
  const diff = end.diff(start, "minutes").minutes;
  return diff > 0 ? Math.round(diff) : null;
}

// Créneau à accès continu. Deux façons de le reconnaître, parce que les sources
// se répartissent en deux familles (voir les constantes ci-dessus) :
//
//  1. amplitude longue ET très supérieure à la durée annoncée — la durée est
//     celle de la VISITE (Puy du Fou) ;
//  2. amplitude longue ET ÉGALE à la durée annoncée — la durée EST la plage
//     d'accès (Miral / Yas Waterworld).
export function isContinuousAccessSlot(
  schedule: ShowSchedule,
  showDuration: number,
  timezone: string,
): boolean {
  const span = getSlotSpanMinutes(schedule, timezone);
  if (span === null || span < CONTINUOUS_MIN_SPAN_MIN) return false;

  // Sans durée annoncée, l'amplitude seule tranche : c'est le cas d'origine.
  if (showDuration <= 0) return true;

  if (span >= CONTINUOUS_SPAN_RATIO * showDuration) return true;

  return (
    span >= CONTINUOUS_LONG_SPAN_MIN &&
    Math.abs(span - showDuration) <= CONTINUOUS_SPAN_TOLERANCE_MIN
  );
}

// Info d'accès à afficher dans le popup : soit une plage horaire (accès continu),
// soit une durée. Un accès continu se reconnaît à un unique créneau long.
export function getShowAccessInfo(
  show: ShowTime,
  timezone: string,
): ShowAccessInfo | null {
  if (
    show.schedules.length === 1 &&
    show.schedules[0].endTime &&
    isContinuousAccessSlot(show.schedules[0], show.duration, timezone)
  ) {
    return {
      kind: "continuous",
      startTime: show.schedules[0].startTime,
      endTime: show.schedules[0].endTime,
    };
  }
  const minutes = getShowDisplayDuration(show, timezone);
  return minutes !== null ? { kind: "duration", minutes } : null;
}

export function getShowDisplayDuration(
  show: ShowTime,
  timezone: string,
): number | null {
  if (show.duration > 0) {
    return show.duration;
  }

  if (show.schedules.length === 0) {
    return null;
  }

  const durations: number[] = [];
  for (const schedule of show.schedules) {
    if (!schedule.endTime) {
      return null;
    }

    const start = DateTime.fromISO(schedule.startTime, { zone: timezone });
    const end = DateTime.fromISO(schedule.endTime, { zone: timezone });
    const diff = end.diff(start, "minutes").minutes;

    if (diff <= 0) {
      return null;
    }

    durations.push(Math.round(diff));
  }

  const firstDuration = durations[0];
  const allSame = durations.every((d) => d === firstDuration);

  return allSame ? firstDuration : null;
}

export function calculateSlotDuration(
  schedule: ShowSchedule,
  showDuration: number,
  nextSchedule: ShowSchedule | null,
  timezone: string,
): number {
  // Accès continu : la barre couvre toute la plage [début, fin] et non la durée
  // de visite (sinon un accès 12:00–20:15 s'afficherait comme un bloc de 20 min).
  if (isContinuousAccessSlot(schedule, showDuration, timezone)) {
    return getSlotSpanMinutes(schedule, timezone)!;
  }

  if (showDuration > 0) {
    return showDuration;
  }

  if (schedule.endTime) {
    const start = DateTime.fromISO(schedule.startTime, { zone: timezone });
    const end = DateTime.fromISO(schedule.endTime, { zone: timezone });
    const diff = end.diff(start, "minutes").minutes;
    if (diff > 0) {
      return Math.round(diff);
    }
  }

  if (nextSchedule) {
    const currentStart = DateTime.fromISO(schedule.startTime, {
      zone: timezone,
    });
    const nextStart = DateTime.fromISO(nextSchedule.startTime, {
      zone: timezone,
    });
    const gap = nextStart.diff(currentStart, "minutes").minutes;

    if (gap > 0 && gap <= 30) {
      return Math.round(gap);
    }
  }

  return 30;
}

// Début du jour LOGIQUE du parc : origine commune à toutes les positions de la
// timeline. Tout est exprimé en minutes depuis cet instant, jamais en heure du
// mur (`.hour`) — c'est ce qui permet à une journée de déborder sur le lendemain
// (parc ouvert jusqu'à minuit, spectacle de 23:55) sans repartir à zéro.
export function getParkDayStart(
  timezone: string,
  parkDate?: string | null,
): DateTime {
  return parkDate
    ? DateTime.fromISO(parkDate, { zone: timezone }).startOf("day")
    : DateTime.now().setZone(timezone).startOf("day");
}

// Garde-fou : une grille ne va jamais au-delà de 03:00 le lendemain, même si une
// source annonce une fin aberrante.
const MAX_GRID_END_HOUR = 27;

const defaultHours = (): number[] => {
  const hours: number[] = [];
  for (let h = 9; h <= 23; h++) hours.push(h);
  return hours;
};

/**
 * Heures (colonnes) de la grille. Les valeurs PEUVENT dépasser 23 : `24` est la
 * colonne « 00:00 » du lendemain. Sans ça, un spectacle de 23:55 débordait de la
 * grille et se retrouvait rogné au bord droit (Disneyland California, ouvert
 * jusqu'à minuit).
 */
export function calculateParkHours(
  shows: ShowTime[],
  timezone: string,
  parkDate?: string | null,
): number[] {
  if (shows.length === 0) return defaultHours();

  // Minutes depuis le début du jour logique (peuvent dépasser 24 h).
  const startMinutes: number[] = [];
  const endMinutes: number[] = [];

  const today = getParkDayStart(timezone, parkDate);

  shows.forEach((show) => {
    const todaySchedules = show.schedules.filter((s) => {
      const start = DateTime.fromISO(s.startTime, { zone: timezone });
      return start >= today;
    });
    todaySchedules.forEach((schedule, index) => {
      const startTime = DateTime.fromISO(schedule.startTime, {
        zone: timezone,
      });
      const fromDayStart = startTime.diff(today, "minutes").minutes;
      startMinutes.push(fromDayStart);

      const nextSchedule = todaySchedules[index + 1] || null;
      const duration = calculateSlotDuration(
        schedule,
        show.duration,
        nextSchedule,
        timezone,
      );
      endMinutes.push(fromDayStart + duration);
    });
  });

  if (startMinutes.length === 0) return defaultHours();

  const minHour = Math.floor(Math.min(...startMinutes) / 60);
  // Dernière colonne NÉCESSAIRE : celle qui contient la dernière minute du
  // dernier créneau (une fin pile à l'heure n'en réclame pas une de plus).
  const lastNeededHour = Math.ceil(Math.max(...endMinutes) / 60) - 1;

  const startHour = Math.max(0, minHour - 1);
  // Une heure de marge après le dernier créneau, comme avant.
  const endHour = Math.min(
    MAX_GRID_END_HOUR,
    Math.max(lastNeededHour, minHour) + 1,
  );

  const hours: number[] = [];
  for (let h = startHour; h <= endHour; h++) {
    hours.push(h);
  }
  return hours;
}

export function getSchedulePosition(
  startTime: string,
  duration: number,
  dayStart: DateTime,
  parkHoursStart: number,
  timezone: string,
): { left: number; width: number } {
  const start = DateTime.fromISO(startTime, { zone: timezone });
  // Position mesurée depuis le début du jour logique : un créneau d'après minuit
  // se place à 24 h+ au lieu de repartir à 0 (donc à gauche de la grille).
  const minutesFromStart =
    start.diff(dayStart, "minutes").minutes - parkHoursStart * 60;

  return { left: minutesFromStart, width: duration };
}

export function calculateScheduleLanes(
  schedules: ShowTime["schedules"],
  showDuration: number,
  parkHoursStart: number,
  timezone: string,
  parkDate?: string | null,
): { schedules: ScheduleWithPosition[]; totalLanes: number } {
  const today = getParkDayStart(timezone, parkDate);

  const sortedSchedules = [...schedules]
    .filter((s) => {
      const start = DateTime.fromISO(s.startTime, { zone: timezone });
      return start >= today;
    })
    .sort((a, b) => {
      const aTime = DateTime.fromISO(a.startTime, { zone: timezone });
      const bTime = DateTime.fromISO(b.startTime, { zone: timezone });
      return aTime.toMillis() - bTime.toMillis();
    });

  const schedulesWithPositions: ScheduleWithPosition[] = sortedSchedules.map(
    (schedule, index) => {
      const nextSchedule = sortedSchedules[index + 1] || null;
      const duration = calculateSlotDuration(
        schedule,
        showDuration,
        nextSchedule,
        timezone,
      );
      const { left, width } = getSchedulePosition(
        schedule.startTime,
        duration,
        today,
        parkHoursStart,
        timezone,
      );
      return { schedule, left, width, lane: 0, duration };
    },
  );

  const lanes: { end: number }[] = [];

  schedulesWithPositions.forEach((item) => {
    let assignedLane = -1;

    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i].end <= item.left) {
        assignedLane = i;
        break;
      }
    }

    if (assignedLane === -1) {
      assignedLane = lanes.length;
      lanes.push({ end: item.left + item.width });
    } else {
      lanes[assignedLane].end = item.left + item.width;
    }

    item.lane = assignedLane;
  });

  return {
    schedules: schedulesWithPositions,
    totalLanes: lanes.length,
  };
}
