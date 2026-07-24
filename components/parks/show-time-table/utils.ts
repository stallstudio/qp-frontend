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

// Créneau à accès continu = fin connue, amplitude longue ET très supérieure à la
// durée de visite (quand celle-ci est connue).
export function isContinuousAccessSlot(
  schedule: ShowSchedule,
  showDuration: number,
  timezone: string,
): boolean {
  const span = getSlotSpanMinutes(schedule, timezone);
  if (span === null || span < CONTINUOUS_MIN_SPAN_MIN) return false;
  if (showDuration > 0 && span < CONTINUOUS_SPAN_RATIO * showDuration) {
    return false;
  }
  return true;
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

export function calculateParkHours(
  shows: ShowTime[],
  timezone: string,
  parkDate?: string | null,
): number[] {
  const hours: number[] = [];

  if (shows.length === 0) {
    for (let h = 9; h <= 23; h++) {
      hours.push(h);
    }
    return hours;
  }

  const allStartTimes: number[] = [];
  const allEndTimes: number[] = [];

  const today = parkDate
    ? DateTime.fromISO(parkDate, { zone: timezone }).startOf("day")
    : DateTime.now().setZone(timezone).startOf("day");

  shows.forEach((show) => {
    const todaySchedules = show.schedules.filter((s) => {
      const start = DateTime.fromISO(s.startTime, { zone: timezone });
      return start >= today;
    });
    todaySchedules.forEach((schedule, index) => {
      const startTime = DateTime.fromISO(schedule.startTime, {
        zone: timezone,
      });
      allStartTimes.push(startTime.hour);

      const nextSchedule = todaySchedules[index + 1] || null;
      const duration = calculateSlotDuration(
        schedule,
        show.duration,
        nextSchedule,
        timezone,
      );
      const endTime = startTime.plus({ minutes: duration });
      // Un créneau qui franchit minuit (ex. La Cinéscénie 22:30 + 90 min = 00:00)
      // retomberait sur l'heure 0 et n'étendrait pas la grille : on le borne à
      // 23 h (la timeline représente une seule journée).
      const crossesMidnight = endTime.toISODate() !== startTime.toISODate();
      allEndTimes.push(crossesMidnight ? 23 : endTime.hour);
    });
  });

  if (allStartTimes.length === 0) {
    for (let h = 9; h <= 23; h++) {
      hours.push(h);
    }
    return hours;
  }

  const minHour = Math.min(...allStartTimes);
  // Inclure les heures de DÉBUT : un spectacle tardif (La Cinéscénie 22:30) doit
  // étendre la grille même si sa fin franchit minuit.
  const maxHour = Math.max(...allStartTimes, ...allEndTimes);

  const startHour = Math.max(0, minHour - 1);
  const endHour = Math.min(23, maxHour + 1);

  for (let h = startHour; h <= endHour; h++) {
    hours.push(h);
  }

  return hours;
}

export function getSchedulePosition(
  startTime: string,
  duration: number,
  parkHoursStart: number,
  timezone: string,
): { left: number; width: number } {
  const start = DateTime.fromISO(startTime, { zone: timezone });
  const minutesFromStart = (start.hour - parkHoursStart) * 60 + start.minute;

  return { left: minutesFromStart, width: duration };
}

export function calculateScheduleLanes(
  schedules: ShowTime["schedules"],
  showDuration: number,
  parkHoursStart: number,
  timezone: string,
  parkDate?: string | null,
): { schedules: ScheduleWithPosition[]; totalLanes: number } {
  const today = parkDate
    ? DateTime.fromISO(parkDate, { zone: timezone }).startOf("day")
    : DateTime.now().setZone(timezone).startOf("day");

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
