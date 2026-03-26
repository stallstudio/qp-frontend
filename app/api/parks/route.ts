import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { DateTime } from "luxon";
import { fetchOpeningHoursForParks } from "@/lib/opening-hours";

export async function GET() {
  try {
    const prisma = getPrisma();

    const twoHoursAgo = DateTime.now().minus({ hours: 2 }).toJSDate();

    const [parks, popularParksData] = await Promise.all([
      prisma.park.findMany({
        where: {
          display: true,
        },
        select: {
          id: true,
          identifier: true,
          name: true,
          timezone: true,
          cover: true,
          badge: true,
          country: true,
          group: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.apiRequestLog.groupBy({
        by: ["parkId"],
        where: {
          createdAt: {
            gte: twoHoursAgo,
          },
          statusCode: 200,
          parkId: {
            not: null,
          },
        },
        _count: {
          parkId: true,
        },
        orderBy: {
          _count: {
            parkId: "desc",
          },
        },
        take: 6,
      }),
    ]);

    const openingHoursByPark = await fetchOpeningHoursForParks(parks);

    const parksWithOpeningHours = parks.map((park: (typeof parks)[number]) => ({
      ...park,
      openingHours: openingHoursByPark.get(park.id) || [],
    }));

    const popularParks = popularParksData
      .map((item) => item.parkId)
      .filter((id): id is string => id !== null);

    return NextResponse.json({
      success: true,
      message: "Parks list retrieved successfully",
      disclaimer:
        "This data is provided by the TWTS (Thrills Wait Times Service) and is strictly intended for authorized use only. Access and usage are exclusively permitted for thrills.world and queue-park.com. Any unauthorized access, use, reproduction, or distribution is strictly prohibited. If you wish to use or integrate this data, you must obtain prior written permission by contacting contact@queue-park.com. Unauthorized usage may result in immediate actions including permanent IP banning and revocation of access without notice. We actively monitor access to ensure compliance. By accessing this data, you agree to these terms.",
      data: {
        parks: parksWithOpeningHours,
        popularParks,
      },
      counts: {
        parks: parksWithOpeningHours.length,
        popularParks: popularParks.length,
      },
    });
  } catch (error) {
    console.error("Error fetching parks list", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to retrieve parks",
      },
      { status: 500 },
    );
  }
}
