import { DateTime } from "luxon";
import { getPrisma } from "@/lib/prisma";
import { OpeningHour } from "@/types/openingHour";

type Park = {
  id: number;
  timezone: string;
  identifier: string;
};

type CloseTimeEntry = { closeTime: Date | string | null };

const SAFE_AFTER_CLOSE_HOUR = 5;

export function resolveParkLogicalDate(
  timezone: string,
  yesterdayHours: CloseTimeEntry[],
): string | null {
  const now = DateTime.now().setZone(timezone);
  if (!now.isValid) return null;

  const today = now.toISODate();
  const yesterday = now.minus({ days: 1 }).toISODate();
  if (!today || !yesterday) return null;

  if (yesterdayHours.length === 0) return today;

  let latestClose: DateTime | null = null;
  for (const entry of yesterdayHours) {
    const ct = entry.closeTime;
    if (!ct) continue;
    const closeDt =
      typeof ct === "string"
        ? DateTime.fromISO(ct, { zone: "utc" }).setZone(timezone)
        : DateTime.fromJSDate(ct).setZone(timezone);
    if (!closeDt.isValid) continue;
    if (!latestClose || closeDt > latestClose) latestClose = closeDt;
  }

  if (!latestClose) return today;

  const midnightToday = DateTime.fromISO(today, { zone: timezone }).startOf(
    "day",
  );

  if (latestClose > midnightToday && now < latestClose) {
    return yesterday;
  }
  return today;
}

export async function calculateParkDate(
  parkId: number,
  timezone: string,
): Promise<string | null> {
  try {
    const now = DateTime.now().setZone(timezone);
    if (!now.isValid) return null;

    const today = now.toISODate();
    if (!today) return null;

    if (now.hour >= SAFE_AFTER_CLOSE_HOUR) {
      return today;
    }

    const yesterday = now.minus({ days: 1 }).toISODate();
    if (!yesterday) return null;

    const prisma = getPrisma();
    const yesterdayHours = await prisma.openingHours.findMany({
      where: { parkId, date: yesterday },
      select: { closeTime: true },
    });

    return resolveParkLogicalDate(timezone, yesterdayHours);
  } catch (error) {
    console.warn(`Invalid timezone: ${timezone}`, error);
    return null;
  }
}

export async function fetchOpeningHoursForParks(
  parks: Park[],
): Promise<Map<number, OpeningHour[]>> {
  const prisma = getPrisma();

  type ParkDates = {
    park: Park;
    today: string;
    yesterday: string;
    now: DateTime;
  };

  const parkDates: ParkDates[] = [];
  for (const park of parks) {
    const now = DateTime.now().setZone(park.timezone);
    if (!now.isValid) {
      console.warn(
        `Invalid timezone for park ${park.identifier}: ${park.timezone}`,
      );
      continue;
    }
    const today = now.toISODate();
    const yesterday = now.minus({ days: 1 }).toISODate();
    if (!today || !yesterday) continue;
    parkDates.push({ park, today, yesterday, now });
  }

  if (parkDates.length === 0) {
    return new Map();
  }

  const orFilters: { parkId: number; date: string }[] = [];
  for (const pd of parkDates) {
    orFilters.push({ parkId: pd.park.id, date: pd.today });
    if (pd.now.hour < SAFE_AFTER_CLOSE_HOUR) {
      orFilters.push({ parkId: pd.park.id, date: pd.yesterday });
    }
  }

  const allOpeningHours = await prisma.openingHours.findMany({
    where: { OR: orFilters },
    select: {
      parkId: true,
      date: true,
      type: true,
      openTime: true,
      closeTime: true,
    },
    orderBy: { type: "asc" },
  });

  const byParkAndDate = new Map<
    number,
    Map<string, typeof allOpeningHours>
  >();
  for (const oh of allOpeningHours) {
    if (!byParkAndDate.has(oh.parkId)) {
      byParkAndDate.set(oh.parkId, new Map());
    }
    const dateMap = byParkAndDate.get(oh.parkId)!;
    if (!dateMap.has(oh.date)) {
      dateMap.set(oh.date, []);
    }
    dateMap.get(oh.date)!.push(oh);
  }

  const result = new Map<number, OpeningHour[]>();
  for (const pd of parkDates) {
    const dateMap = byParkAndDate.get(pd.park.id);
    let resolvedDate: string;

    if (pd.now.hour >= SAFE_AFTER_CLOSE_HOUR) {
      resolvedDate = pd.today;
    } else {
      const yesterdayEntries = dateMap?.get(pd.yesterday) ?? [];
      resolvedDate =
        resolveParkLogicalDate(pd.park.timezone, yesterdayEntries) ??
        pd.today;
    }

    const entries = dateMap?.get(resolvedDate) ?? [];
    result.set(
      pd.park.id,
      entries.map((entry) => ({
        date: entry.date,
        type: entry.type,
        openTime: entry.openTime ? entry.openTime.toISOString() : null,
        closeTime: entry.closeTime ? entry.closeTime.toISOString() : null,
      })),
    );
  }

  return result;
}

export async function getOpeningHoursByParkAndDate(
  parkId: number,
  date: string,
): Promise<OpeningHour[]> {
  try {
    const prisma = getPrisma();

    const entries = await prisma.openingHours.findMany({
      where: {
        parkId,
        date,
      },
    });

    return entries.map((entry) => ({
      date: entry.date,
      type: entry.type as "standard" | "early_access" | "extension",
      openTime: entry.openTime ? entry.openTime.toISOString() : null,
      closeTime: entry.closeTime ? entry.closeTime.toISOString() : null,
    }));
  } catch (error) {
    return [];
  }
}
