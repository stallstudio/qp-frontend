import { Prisma } from "@prisma/client";
import { DateTime } from "luxon";
import { getPrisma } from "@/lib/prisma";

/**
 * A past park day only counts as usable if at least MIN_OPEN_RIDES distinct
 * rides were each open for more than MIN_RIDE_OPEN_MINUTES.
 *
 * The providers occasionally emit a one-off blip — a single ride reporting
 * "open" for under a minute on a day the park never operated. The duration test
 * keeps those out: measured over real data, blip days have exactly 1 ride open
 * for under an hour, real days have 20+ rides open for ~8h each.
 *
 * Today is exempt from the duration test only (the day is still accumulating);
 * the ride-count test still applies, which keeps a lone blip out — a park
 * opening flips its whole line-up to "open" within one poll.
 *
 * Opening hours are NOT usable as the signal: roughly a third of the genuine
 * operating days carry an OpeningHours row with openTime/closeTime both null,
 * indistinguishable from a real closure.
 */
export const MIN_OPEN_RIDES = 2;
export const MIN_RIDE_OPEN_MINUTES = 120;

/** Today as the park itself reckons it, not as the server's clock does. */
function parkToday(timezone: string): string {
  return DateTime.now().setZone(timezone).toISODate() ?? "";
}

/**
 * Rows of `date_str` for every usable day, optionally restricted to a UTC
 * startTime window. A wait_times row records one state span (startTime →
 * endTime), so an all-day open ride is a single long row: duration is what
 * matters, not row count. Ongoing spans (endTime null) are measured up to
 * lastSeenAt.
 */
function usableDatesQuery(
  parkId: number,
  timezone: string,
  window: Prisma.Sql = Prisma.empty,
): Prisma.Sql {
  return Prisma.sql`
    SELECT per_ride.date_str
    FROM (
      SELECT DATE(CONVERT_TZ(wt.startTime, 'UTC', ${timezone})) AS date_str,
             COALESCE(wt.rideId, r.id) AS ride_id,
             SUM(
               TIMESTAMPDIFF(SECOND, wt.startTime, COALESCE(wt.endTime, wt.lastSeenAt))
             ) AS open_secs
      FROM wait_times wt
      LEFT JOIN rides r ON r.externalId = wt.externalId AND r.parkId = ${parkId}
      WHERE wt.parkId = ${parkId}
        AND wt.type = 'standby'
        AND wt.status = 'open'
        AND COALESCE(wt.rideId, r.id) IS NOT NULL
        ${window}
      GROUP BY date_str, ride_id
      HAVING open_secs > IF(date_str = ${parkToday(timezone)}, 0, ${MIN_RIDE_OPEN_MINUTES * 60})
    ) per_ride
    GROUP BY per_ride.date_str
    HAVING COUNT(*) >= ${MIN_OPEN_RIDES}
    ORDER BY per_ride.date_str ASC
  `;
}

function toDateString(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

/** Every usable day for the park, optionally within a UTC startTime window. */
export async function getUsableDates(
  parkId: number,
  timezone: string,
  window?: { from: Date; to: Date },
): Promise<string[]> {
  const prisma = getPrisma();
  const clause = window
    ? Prisma.sql`AND wt.startTime >= ${window.from} AND wt.startTime < ${window.to}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<{ date_str: unknown }[]>(
    usableDatesQuery(parkId, timezone, clause),
  );
  return rows.map((r) => toDateString(r.date_str)).filter(Boolean);
}

/** The most recent usable day, or null if the park has none. */
export async function getLatestUsableDate(
  parkId: number,
  timezone: string,
): Promise<string | null> {
  const dates = await getUsableDates(parkId, timezone);
  return dates.length ? dates[dates.length - 1] : null;
}

/** Whether a single day is usable — guards direct ?date= URLs. */
export async function isUsableDate(
  parkId: number,
  timezone: string,
  dateStr: string,
): Promise<boolean> {
  const prisma = getPrisma();
  const clause = Prisma.sql`AND DATE(CONVERT_TZ(wt.startTime, 'UTC', ${timezone})) = ${dateStr}`;
  const rows = await prisma.$queryRaw<{ date_str: unknown }[]>(
    usableDatesQuery(parkId, timezone, clause),
  );
  return rows.length > 0;
}
