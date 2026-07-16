import { DateTime } from "luxon";
import { getPrisma } from "@/lib/prisma";
import { isUsableDate } from "@/lib/park-usable-days";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DayOpeningHour {
  type: string;
  openTime: string | null; // ISO (UTC) — formatted client-side to the user's 12/24h pref
  closeTime: string | null;
}

export interface ChartSegment {
  start: string; // "HH:mm" (may exceed 24:00 for after-midnight closing)
  end: string;
  waitTime: number;
  status: string;
}

export interface RideDayStat {
  rideId: number;
  rideName: string;
  /** Time-weighted mean wait over the day's open slots, in minutes (rounded). */
  averageWait: number;
  /** True if the ride ran at all (had at least one open reading) that day. */
  operated: boolean;
  /**
   * Dominant status over the day ("closed" | "down" | "maintenance" | "open").
   * Only meaningful for the label of a ride that never operated.
   */
  status: string;
  chartData: ChartSegment[];
}

export interface DayProfilePoint {
  hour: number; // 0–23 (local)
  avgWait: number | null; // park-wide mean over open rides that hour, null if none
}

export interface ParkDayStats {
  park: { id: number; name: string; timezone: string };
  date: string;
  openingHours: DayOpeningHour[];
  chartBounds: { start: string; end: string };
  rides: RideDayStat[];
  dayProfile: DayProfilePoint[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtMin = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

const slotKey = (m: number) => fmtMin(m);

interface RawWaitTime {
  rideId: number | null;
  waitTime: number;
  status: string;
  startTime: Date;
  endTime: Date | null;
}

/**
 * Everything the public "stats for a day" view needs, for one park + local date.
 *
 * Mirrors the admin computation (10-minute slot filling, run-length-encoded
 * segments) but adds the two things the public view sorts and summarises by:
 * a per-ride time-weighted average, and a park-wide hourly profile. Rides come
 * back sorted by that average, busiest first — not alphabetically.
 *
 * Returns null rides for a non-usable day (a hand-typed ?date= that never really
 * operated) rather than a chart built from a stray blip.
 */
export async function getParkDayStats(
  park: { id: number; name: string; timezone: string },
  dateStr: string,
): Promise<ParkDayStats> {
  const prisma = getPrisma();
  const { id: parkId, timezone } = park;

  const [usable, openingHoursRows, rides, rawWaitTimes] = await Promise.all([
    isUsableDate(parkId, timezone, dateStr),
    prisma.openingHours.findMany({
      where: { parkId, date: dateStr },
      orderBy: { type: "asc" },
    }),
    prisma.ride.findMany({
      where: { parkId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.$queryRaw<RawWaitTime[]>`
      SELECT COALESCE(wt.rideId, r.id) AS rideId,
             wt.waitTime, wt.status, wt.startTime, wt.endTime
      FROM wait_times wt
      LEFT JOIN rides r ON r.externalId = wt.externalId
                       AND r.parkId = ${parkId}
      WHERE wt.parkId = ${parkId}
        AND wt.type = 'standby'
        AND COALESCE(wt.rideId, r.id) IS NOT NULL
        AND (
          DATE(CONVERT_TZ(wt.startTime, 'UTC', ${timezone})) = ${dateStr}
          OR (
            DATE(CONVERT_TZ(wt.startTime, 'UTC', ${timezone})) < ${dateStr}
            AND (wt.endTime IS NULL OR DATE(CONVERT_TZ(wt.endTime, 'UTC', ${timezone})) >= ${dateStr})
          )
        )
      ORDER BY wt.startTime ASC
    `,
  ]);

  const openingHours: DayOpeningHour[] = openingHoursRows.map((oh) => ({
    type: oh.type,
    openTime: oh.openTime ? oh.openTime.toISOString() : null,
    closeTime: oh.closeTime ? oh.closeTime.toISOString() : null,
  }));

  const empty: ParkDayStats = {
    park,
    date: dateStr,
    openingHours,
    chartBounds: { start: "09:00", end: "20:00" },
    rides: [],
    dayProfile: [],
  };
  if (!usable) return empty;

  const zoned = (d: Date) => DateTime.fromJSDate(d).setZone(timezone);

  // Group raw entries by rideId
  const entriesByRide = new Map<number, RawWaitTime[]>();
  for (const wt of rawWaitTimes) {
    if (wt.rideId === null) continue;
    const list = entriesByRide.get(wt.rideId);
    if (list) list.push(wt);
    else entriesByRide.set(wt.rideId, [wt]);
  }

  // ── Chart bounds (minutes from midnight; >1440 allowed for after-midnight) ──
  let startMin: number | null = null;
  let endMin: number | null = null;

  for (const oh of openingHoursRows) {
    if (oh.openTime) {
      const l = zoned(oh.openTime);
      const m = l.hour * 60 + l.minute;
      if (startMin === null || m < startMin) startMin = m;
    }
    if (oh.closeTime) {
      const l = zoned(oh.closeTime);
      let m = l.hour * 60 + l.minute;
      if ((l.toISODate() ?? "") > dateStr) m += 1440; // closes after midnight
      if (endMin === null || m > endMin) endMin = m;
    }
  }

  // No opening hours: derive the window from recorded "open" data.
  if (startMin === null || endMin === null) {
    let dataStart: number | null = null;
    let dataEnd: number | null = null;
    for (const wt of rawWaitTimes) {
      if (wt.status !== "open") continue;
      const sl = zoned(wt.startTime);
      if ((sl.toISODate() ?? "") !== dateStr) continue;
      const m = sl.hour * 60 + sl.minute;
      if (dataStart === null || m < dataStart) dataStart = m;
      if (dataEnd === null || m > dataEnd) dataEnd = m;
    }
    if (startMin === null && dataStart !== null) startMin = dataStart;
    if (endMin === null && dataEnd !== null) endMin = dataEnd;
  }

  if (startMin === null) startMin = 540; // 09:00
  if (endMin === null) endMin = 1200; // 20:00
  if (endMin < startMin) endMin += 1440;

  const chartBounds = { start: fmtMin(startMin), end: fmtMin(endMin) };

  // Viewing today: cap the window to the current 10-min slot.
  const nowLocal = DateTime.now().setZone(timezone);
  if (dateStr === (nowLocal.toISODate() ?? "")) {
    const nowM = Math.floor(nowLocal.minute / 10) * 10;
    const nowSlot = `${String(nowLocal.hour).padStart(2, "0")}:${String(nowM).padStart(2, "0")}`;
    if (nowSlot < chartBounds.end) chartBounds.end = nowSlot;
  }

  // ── Per-ride slot fill (10-min), then RLE + average + status + profile ──
  // A ride is excluded from the day-profile average when it is BOTH stale (its
  // reading hasn't changed for several days — a single frozen span) AND stuck at
  // a nominal wait (≤ 5 min). Those never-moving kiddie/placeholder rides only
  // drag the profile down; a ride frozen at a genuinely high wait still counts.
  const PROFILE_STALE_DAYS = 2;
  const PROFILE_NOMINAL_MAX = 5;

  type RideProfile = { readings: { hour: number; wait: number }[]; drag: boolean };

  const rideStats: RideDayStat[] = [];
  const rideProfiles: RideProfile[] = [];

  for (const ride of rides) {
    const entries = entriesByRide.get(ride.id) ?? [];
    if (entries.length === 0) continue;

    const slots: Record<string, { waitTime: number; status: string }> = {};
    let latestStart = ""; // most recent local date a reading started on

    for (const entry of entries) {
      const startLocal = zoned(entry.startTime);
      const startMinRide = startLocal.hour * 60 + startLocal.minute;
      const startLocalDate = startLocal.toISODate() ?? "";
      if (startLocalDate > latestStart) latestStart = startLocalDate;

      let endMinInDay: number;
      if (entry.endTime) {
        const endLocal = zoned(entry.endTime);
        endMinInDay =
          (endLocal.toISODate() ?? "") > dateStr
            ? 1440
            : endLocal.hour * 60 + endLocal.minute;
      } else {
        endMinInDay = 1440;
      }

      const data = { waitTime: entry.waitTime, status: entry.status };

      if (startLocalDate < dateStr) {
        // Overnight entry: fill the whole day from 00:00.
        for (let m = 0; m < endMinInDay; m += 10) slots[slotKey(m)] = data;
      } else {
        const floorSlot = Math.floor(startMinRide / 10) * 10;
        if (!slots[slotKey(floorSlot)]) slots[slotKey(floorSlot)] = data;
        const ceilSlot =
          startMinRide % 10 === 0 ? startMinRide : Math.ceil(startMinRide / 10) * 10;
        for (let m = ceilSlot; m < endMinInDay; m += 10) slots[slotKey(m)] = data;
      }
    }

    const sortedSlots = Object.entries(slots)
      .sort(([a], [b]) => a.localeCompare(b))
      .filter(([time]) => time >= chartBounds.start && time <= chartBounds.end);

    const chartData: ChartSegment[] = [];
    const statusCounts = new Map<string, number>();
    const openReadings: { hour: number; wait: number }[] = [];
    let waitSum = 0;
    let waitCount = 0;

    for (const [time, data] of sortedSlots) {
      const last = chartData[chartData.length - 1];
      if (last && last.waitTime === data.waitTime && last.status === data.status) {
        last.end = time;
      } else {
        chartData.push({
          start: time,
          end: time,
          waitTime: data.waitTime,
          status: data.status,
        });
      }
      statusCounts.set(data.status, (statusCounts.get(data.status) ?? 0) + 1);
      // Averages count only genuinely-open readings.
      if (data.status === "open" && data.waitTime >= 0) {
        waitSum += data.waitTime;
        waitCount += 1;
        const [hh] = time.split(":").map(Number);
        openReadings.push({ hour: hh, wait: data.waitTime });
      }
    }

    // Dominant status over the day (what "comes out most").
    let status = "open";
    let best = -1;
    for (const [s, c] of statusCounts) {
      if (c > best) {
        best = c;
        status = s;
      }
    }

    const averageWait = waitCount > 0 ? Math.round(waitSum / waitCount) : 0;
    const staleDays = latestStart
      ? Math.round(
          DateTime.fromISO(dateStr).diff(DateTime.fromISO(latestStart), "days")
            .days,
        )
      : 0;
    const drag =
      staleDays >= PROFILE_STALE_DAYS && averageWait <= PROFILE_NOMINAL_MAX;

    rideStats.push({
      rideId: ride.id,
      rideName: ride.name,
      averageWait,
      operated: waitCount > 0,
      status,
      chartData,
    });
    if (openReadings.length > 0) rideProfiles.push({ readings: openReadings, drag });
  }

  // Drop rides that never really ran (no positive wait AND no explicit closure).
  const visibleRides = rideStats.filter((r) =>
    r.chartData.some(
      (d) =>
        d.waitTime > 0 ||
        d.status === "closed" ||
        d.status === "down" ||
        d.status === "maintenance",
    ),
  );

  // Busiest first — the whole point of the public view.
  visibleRides.sort((a, b) => b.averageWait - a.averageWait);

  // ── Hourly park-wide profile across the bounds ──
  // Prefer the rides that actually move; if every ride is a frozen nominal one,
  // fall back to all of them rather than showing an empty profile.
  const movingProfiles = rideProfiles.filter((r) => !r.drag);
  const profileSource = movingProfiles.length > 0 ? movingProfiles : rideProfiles;
  const profileBuckets = new Map<number, { sum: number; count: number }>();
  for (const r of profileSource) {
    for (const { hour, wait } of r.readings) {
      const b = profileBuckets.get(hour) ?? { sum: 0, count: 0 };
      b.sum += wait;
      b.count += 1;
      profileBuckets.set(hour, b);
    }
  }

  const dayProfile: DayProfilePoint[] = [];
  const firstHour = Math.floor(startMin / 60);
  const lastHour = Math.floor(endMin / 60);
  for (let h = firstHour; h <= lastHour; h++) {
    const b = profileBuckets.get(h);
    dayProfile.push({
      hour: h % 24,
      avgWait: b && b.count > 0 ? Math.round(b.sum / b.count) : null,
    });
  }

  return { park, date: dateStr, openingHours, chartBounds, rides: visibleRides, dayProfile };
}
