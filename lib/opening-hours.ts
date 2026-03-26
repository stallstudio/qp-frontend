import { DateTime } from "luxon";
import { getPrisma } from "@/lib/prisma";
import { OpeningHour } from "@/types/openingHour";

type Park = {
  id: number;
  timezone: string;
  identifier: string;
};

type ParkWithDate = {
  parkId: number;
  date: string;
};

export function calculateParkDate(timezone: string): string | null {
  try {
    const nowInParkTimezone = DateTime.now().setZone(timezone);
    const hour = nowInParkTimezone.hour;

    const today =
      hour < 2
        ? nowInParkTimezone.minus({ days: 1 }).toISODate()
        : nowInParkTimezone.toISODate();

    return today;
  } catch (error) {
    console.warn(`Invalid timezone: ${timezone}`, error);
    return null;
  }
}

export async function fetchOpeningHoursForParks(
  parks: Park[],
): Promise<Map<number, any[]>> {
  const prisma = getPrisma();

  const datesByPark: ParkWithDate[] = parks
    .map((park) => {
      const date = calculateParkDate(park.timezone);
      if (!date) {
        console.warn(
          `Invalid timezone for park ${park.identifier}: ${park.timezone}`,
        );
        return null;
      }
      return { parkId: park.id, date };
    })
    .filter((item): item is ParkWithDate => item !== null);

  if (datesByPark.length === 0) {
    return new Map();
  }

  const allOpeningHours = await prisma.openingHours.findMany({
    where: {
      OR: datesByPark.map(({ parkId, date }) => ({
        parkId,
        date,
      })),
    },
    select: {
      parkId: true,
      type: true,
      openTime: true,
      closeTime: true,
    },
    orderBy: {
      type: "asc",
    },
  });

  const openingHoursByPark = new Map<number, any[]>();
  allOpeningHours.forEach((oh) => {
    if (!openingHoursByPark.has(oh.parkId)) {
      openingHoursByPark.set(oh.parkId, []);
    }
    const { parkId, ...rest } = oh;
    openingHoursByPark.get(oh.parkId)!.push(rest);
  });

  return openingHoursByPark;
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
