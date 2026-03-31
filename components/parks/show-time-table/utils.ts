import { ShowTime, ShowSchedule } from "@/types/show";
import { DateTime } from "luxon";
import { ScheduleWithPosition } from "./types";

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h${remainingMinutes.toString().padStart(2, "0")}`;
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
): number[] {
  const hours: number[] = [];
  const allTimes = shows.flatMap((show) =>
    show.schedules.map(
      (s) => DateTime.fromISO(s.startTime, { zone: timezone }).hour,
    ),
  );

  if (allTimes.length === 0) {
    for (let h = 9; h <= 23; h++) {
      hours.push(h);
    }
    return hours;
  }

  const minHour = Math.min(...allTimes);
  const maxHour = Math.max(...allTimes);

  const startHour = Math.max(0, minHour - 1);
  const endHour = Math.min(23, maxHour + 2);

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
): { schedules: ScheduleWithPosition[]; totalLanes: number } {
  const sortedSchedules = [...schedules].sort((a, b) => {
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
