import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";

/**
 * How busy a park day was, relative to a normal day at that same park.
 *
 * Raw minutes can't say that: 40 min is a quiet Tuesday at one park and a packed
 * August Saturday at another. Nor can a park-wide daily average — it silently
 * tracks *which* rides ran. Close the flagship coaster and the average collapses,
 * and a rammed day reads as "quiet".
 *
 * So each ride is scored against its own history, and the day is the median of
 * those ratios:
 *
 *   1. Per ride per day: mean wait weighted by how long each reading held, over
 *      CORE_START/CORE_END only. The open and close tails are near-empty at every
 *      park and would drag every day toward "quiet" by an amount that depends on
 *      opening hours rather than on crowds.
 *   2. Per ride: a baseline = the median of those daily means over the trailing
 *      BASELINE_HISTORY_DAYS. Rides whose queue never moves are dropped first —
 *      see SIGNAL_MIN_SPREAD.
 *   3. Ratio = (day + SMOOTHING_MIN) / (baseline + SMOOTHING_MIN).
 *   4. Day index = median of the ratios of the rides that ran.
 *
 * The index is then cut into levels against *the park's own distribution*, not
 * fixed bounds — see the `rank` field.
 */

export const CORE_START = "11:00:00";
export const CORE_END = "17:00:00";

/** A ride open only briefly inside the core window says nothing about the day. */
export const MIN_RIDE_CORE_MINUTES = 60;

/** Below this, the median is a coin toss — report nothing rather than a colour. */
export const MIN_RIDES_FOR_INDEX = 3;

/** A baseline from one or two days is just those days, not a norm. */
export const MIN_DAYS_FOR_BASELINE = 5;

export const BASELINE_HISTORY_DAYS = 365;

/** Damps ratios for rides whose baseline is near zero. In minutes. */
export const SMOOTHING_MIN = 5;

/**
 * Minimum relative spread — (p90 − p10) / (baseline + SMOOTHING_MIN) — for a
 * ride's daily means to count toward the index at all. Without this the index is
 * meaningless at parks that publish nominal waits for playgrounds/walkthroughs.
 */
export const SIGNAL_MIN_SPREAD = 0.25;

/** Ranking needs a distribution to rank against. */
export const MIN_DAYS_FOR_LEVELS = 20;

/**
 * Largest share of days allowed to share one identical index before the park is
 * declared unscorable and shown with no colours at all. A big bloc of exact ties
 * breaks the ranking assumption and the ranks stop meaning anything.
 */
export const MAX_MODAL_SHARE = 0.3;

export interface DayAffluence {
  date: string;
  /** Median ride ratio. 1.0 = a typical day at this park. */
  index: number;
  /**
   * Where the day sits in this park's own recorded history: 0 = its quietest day,
   * 1 = its busiest. This is what the UI colours by. Ranks are comparable within a
   * park, never across parks.
   */
  rank: number;
  /** How many rides backed the median — lets the UI flag a thin reading. */
  rideCount: number;
}

interface RideDayRow {
  date_str: unknown;
  ride_id: number | bigint;
  mean_wait: unknown;
  core_secs: unknown;
}

interface RideDay {
  date: string;
  rideId: number;
  meanWait: number;
}

function quantile(sorted: number[], p: number): number {
  return sorted[Math.floor((sorted.length - 1) * p)];
}

/** How many values in `sorted` are strictly less than `x`. */
function lowerBound(sorted: number[], x: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Share of values taken by the single most repeated one. See MAX_MODAL_SHARE. */
function modalShare(values: number[]): number {
  const counts = new Map<number, number>();
  let modal = 0;
  for (const v of values) {
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (n > modal) modal = n;
  }
  return values.length ? modal / values.length : 0;
}

function toDateString(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

/** MariaDB returns DECIMAL/BIGINT as string or bigint depending on the driver. */
function toNumber(v: unknown): number {
  return typeof v === "number" ? v : Number(v);
}

/**
 * Time-weighted mean wait per ride per day, inside the core window.
 *
 * A wait_times row is one state span holding a constant waitTime, so the mean has
 * to be weighted by each span's duration, not by row count. Ongoing spans
 * (endTime null) are measured to lastSeenAt. A span is attributed to the local
 * date it starts on.
 */
function rideDayMeansQuery(
  parkId: number,
  timezone: string,
  from: Date,
): Prisma.Sql {
  return Prisma.sql`
    SELECT date_str,
           ride_id,
           SUM(wait_time * overlap_secs) / SUM(overlap_secs) AS mean_wait,
           SUM(overlap_secs) AS core_secs
    FROM (
      SELECT DATE(CONVERT_TZ(wt.startTime, 'UTC', ${timezone})) AS date_str,
             COALESCE(wt.rideId, r.id) AS ride_id,
             wt.waitTime AS wait_time,
             GREATEST(0, TIMESTAMPDIFF(
               SECOND,
               GREATEST(
                 CONVERT_TZ(wt.startTime, 'UTC', ${timezone}),
                 TIMESTAMP(DATE(CONVERT_TZ(wt.startTime, 'UTC', ${timezone})), ${CORE_START})
               ),
               LEAST(
                 CONVERT_TZ(COALESCE(wt.endTime, wt.lastSeenAt), 'UTC', ${timezone}),
                 TIMESTAMP(DATE(CONVERT_TZ(wt.startTime, 'UTC', ${timezone})), ${CORE_END})
               )
             )) AS overlap_secs
      FROM wait_times wt
      LEFT JOIN rides r ON r.externalId = wt.externalId AND r.parkId = ${parkId}
      WHERE wt.parkId = ${parkId}
        AND wt.type = 'standby'
        AND wt.status = 'open'
        AND wt.waitTime >= 0
        AND COALESCE(wt.rideId, r.id) IS NOT NULL
        AND wt.startTime >= ${from}
    ) spans
    WHERE overlap_secs > 0
    GROUP BY date_str, ride_id
    HAVING core_secs >= ${MIN_RIDE_CORE_MINUTES * 60}
  `;
}

async function fetchRideDayMeans(
  parkId: number,
  timezone: string,
): Promise<RideDay[]> {
  const prisma = getPrisma();
  const from = new Date(Date.now() - BASELINE_HISTORY_DAYS * 86400_000);
  const rows = await prisma.$queryRaw<RideDayRow[]>(
    rideDayMeansQuery(parkId, timezone, from),
  );
  return rows.map((r) => ({
    date: toDateString(r.date_str),
    rideId: Number(r.ride_id),
    meanWait: toNumber(r.mean_wait),
  }));
}

/** Baseline per ride, keeping only rides whose queue actually responds to crowds. */
function signalBaselines(rideDays: RideDay[]): Map<number, number> {
  const byRide = new Map<number, number[]>();
  for (const rd of rideDays) {
    const list = byRide.get(rd.rideId);
    if (list) list.push(rd.meanWait);
    else byRide.set(rd.rideId, [rd.meanWait]);
  }

  const baselines = new Map<number, number>();
  for (const [rideId, means] of byRide) {
    if (means.length < MIN_DAYS_FOR_BASELINE) continue;
    const sorted = [...means].sort((a, b) => a - b);
    const baseline = median(sorted);
    const spread =
      (quantile(sorted, 0.9) - quantile(sorted, 0.1)) /
      (baseline + SMOOTHING_MIN);
    if (spread < SIGNAL_MIN_SPREAD) continue;
    baselines.set(rideId, baseline);
  }
  return baselines;
}

/**
 * Every day in the trailing year that can be scored, keyed by date. One pass over
 * the park's whole history — the baselines and the level cuts are drawn from the
 * same rows as the days being scored.
 */
export async function getParkAffluence(
  parkId: number,
  timezone: string,
): Promise<Map<string, DayAffluence>> {
  const rideDays = await fetchRideDayMeans(parkId, timezone);
  const baselines = signalBaselines(rideDays);

  const ratiosByDate = new Map<string, number[]>();
  for (const rd of rideDays) {
    const baseline = baselines.get(rd.rideId);
    if (baseline === undefined) continue;
    const ratio = (rd.meanWait + SMOOTHING_MIN) / (baseline + SMOOTHING_MIN);
    const list = ratiosByDate.get(rd.date);
    if (list) list.push(ratio);
    else ratiosByDate.set(rd.date, [ratio]);
  }

  const scored: { date: string; index: number; rideCount: number }[] = [];
  for (const [date, ratios] of ratiosByDate) {
    if (ratios.length < MIN_RIDES_FOR_INDEX) continue;
    scored.push({ date, index: median(ratios), rideCount: ratios.length });
  }

  const result = new Map<string, DayAffluence>();
  if (scored.length < MIN_DAYS_FOR_LEVELS) return result;
  if (modalShare(scored.map((s) => s.index)) > MAX_MODAL_SHARE) return result;

  const sortedIdx = scored.map((s) => s.index).sort((a, b) => a - b);

  for (const s of scored) {
    // Share of days strictly quieter than this one, so a bloc of days with an
    // identical index all get the same rank rather than being smeared.
    const below = lowerBound(sortedIdx, s.index);
    result.set(s.date, { ...s, rank: below / (sortedIdx.length - 1) });
  }
  return result;
}

const round = (n: number, d = 2) => Number(n.toFixed(d));

/**
 * Same pipeline as {@link getParkAffluence}, but returns the count at every gate
 * instead of the coloured days — so we can see *why* a park ends up with no
 * colours. Diagnostic only; not cached. Reach it via `?debug=1` on the endpoint.
 */
export async function getParkAffluenceDebug(parkId: number, timezone: string) {
  const rideDays = await fetchRideDayMeans(parkId, timezone);

  const byRide = new Map<number, number[]>();
  for (const rd of rideDays) {
    const list = byRide.get(rd.rideId);
    if (list) list.push(rd.meanWait);
    else byRide.set(rd.rideId, [rd.meanWait]);
  }

  const droppedFewDays: { rideId: number; days: number }[] = [];
  const droppedLowSpread: {
    rideId: number;
    days: number;
    baseline: number;
    spread: number;
  }[] = [];
  const baselines = new Map<number, number>();
  for (const [rideId, means] of byRide) {
    if (means.length < MIN_DAYS_FOR_BASELINE) {
      droppedFewDays.push({ rideId, days: means.length });
      continue;
    }
    const sorted = [...means].sort((a, b) => a - b);
    const baseline = median(sorted);
    const spread =
      (quantile(sorted, 0.9) - quantile(sorted, 0.1)) /
      (baseline + SMOOTHING_MIN);
    if (spread < SIGNAL_MIN_SPREAD) {
      droppedLowSpread.push({
        rideId,
        days: means.length,
        baseline: round(baseline),
        spread: round(spread),
      });
      continue;
    }
    baselines.set(rideId, baseline);
  }

  const ratiosByDate = new Map<string, number[]>();
  for (const rd of rideDays) {
    const baseline = baselines.get(rd.rideId);
    if (baseline === undefined) continue;
    const ratio = (rd.meanWait + SMOOTHING_MIN) / (baseline + SMOOTHING_MIN);
    const list = ratiosByDate.get(rd.date);
    if (list) list.push(ratio);
    else ratiosByDate.set(rd.date, [ratio]);
  }

  let scoredDays = 0;
  let daysDroppedFewSignalRides = 0;
  const indices: number[] = [];
  for (const [, ratios] of ratiosByDate) {
    if (ratios.length < MIN_RIDES_FOR_INDEX) {
      daysDroppedFewSignalRides++;
      continue;
    }
    scoredDays++;
    indices.push(median(ratios));
  }

  const share = round(modalShare(indices), 3);
  const levelsPass = scoredDays >= MIN_DAYS_FOR_LEVELS;
  const modalPass = share <= MAX_MODAL_SHARE;

  // Distribution of the day indices, to see *what* is repeating.
  const histo = new Map<number, number>();
  for (const v of indices) {
    const k = round(v, 3);
    histo.set(k, (histo.get(k) ?? 0) + 1);
  }
  const indexHistogram = [...histo.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([value, count]) => ({ value, count }));
  const sortedIdx = [...indices].sort((a, b) => a - b);
  const indexStats = indices.length
    ? {
        distinctValues: histo.size,
        min: round(sortedIdx[0], 3),
        median: round(median(indices), 3),
        max: round(sortedIdx[sortedIdx.length - 1], 3),
      }
    : null;

  let verdict = "OK — le parc serait coloré";
  if (!levelsPass) {
    verdict = `BLOQUÉ : seulement ${scoredDays} jour(s) scoré(s), il en faut ${MIN_DAYS_FOR_LEVELS}`;
  } else if (!modalPass) {
    verdict = `BLOQUÉ : trop d'égalités (modalShare ${share} > ${MAX_MODAL_SHARE})`;
  }

  return {
    thresholds: {
      MIN_RIDE_CORE_MINUTES,
      MIN_RIDES_FOR_INDEX,
      MIN_DAYS_FOR_BASELINE,
      SIGNAL_MIN_SPREAD,
      MIN_DAYS_FOR_LEVELS,
      MAX_MODAL_SHARE,
      coreWindow: `${CORE_START}–${CORE_END}`,
    },
    rideDayRows: rideDays.length,
    distinctRides: byRide.size,
    ridesWithEnoughHistory: byRide.size - droppedFewDays.length,
    signalRides: baselines.size,
    droppedForFewDays: droppedFewDays.length,
    droppedForLowSpread: droppedLowSpread.length,
    droppedLowSpreadDetail: droppedLowSpread.slice(0, 40),
    scoredDays,
    daysDroppedFewSignalRides,
    modalShare: share,
    indexStats,
    indexHistogram,
    gates: {
      minDaysForLevels: { need: MIN_DAYS_FOR_LEVELS, have: scoredDays, pass: levelsPass },
      maxModalShare: { limit: MAX_MODAL_SHARE, value: share, pass: modalPass },
    },
    resultDays: levelsPass && modalPass ? scoredDays : 0,
    verdict,
  };
}
