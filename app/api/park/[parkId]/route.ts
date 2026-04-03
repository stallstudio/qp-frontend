import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import {
  calculateParkDate,
  getOpeningHoursByParkAndDate,
} from "@/lib/opening-hours";
import { getLatestWaitTimesByPark } from "@/lib/wait-times";
import { getShowTimesByParkAndDate } from "@/lib/show-times";
import { ParkLiveData, CoverImage } from "@/types/api";

function normalizeCover(raw: unknown): CoverImage[] | null {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return null;
  return raw.map((item: unknown) => {
    if (typeof item === "string") return { url: item, credit: null };
    if (typeof item === "object" && item !== null && "url" in item) {
      const obj = item as { url: string; credit?: string | null };
      return { url: obj.url, credit: obj.credit ?? null };
    }
    return { url: String(item), credit: null };
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ parkId: string }> },
) {
  const { parkId } = await params;

  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0] ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const userAgent = request.headers.get("user-agent");
  const referer = request.headers.get("referer");

  try {
    const prisma = getPrisma();
    const park = await prisma.park.findUnique({
      where: { identifier: parkId, display: true },
      select: {
        id: true,
        identifier: true,
        name: true,
        timezone: true,
        cover: true,
        queueTypeLabels: true,
        lastUpdatedAt: true,
      },
    });

    if (!park) {
      await prisma.apiRequestLog.create({
        data: {
          endpoint: `/api/park/${parkId}`,
          parkId,
          ipAddress,
          userAgent,
          referer,
          statusCode: 404,
        },
      });

      return NextResponse.json(
        {
          error: "Not found",
          message: `Park not found: ${parkId}`,
        },
        { status: 404 },
      );
    }

    const today = calculateParkDate(park.timezone);

    if (!today) {
      await prisma.apiRequestLog.create({
        data: {
          endpoint: `/api/park/${parkId}`,
          parkId,
          ipAddress,
          userAgent,
          referer,
          statusCode: 500,
        },
      });

      return NextResponse.json(
        {
          error: "An error occurred while calculating the park date",
          message: `Timezone seems incorrect: ${park.timezone}`,
        },
        { status: 500 },
      );
    }

    const waitTimes = await getLatestWaitTimesByPark(park.id);
    const showTimes = await getShowTimesByParkAndDate(park.id, today);
    const openingHours = await getOpeningHoursByParkAndDate(park.id, today);

    const lastUpdate =
      park.lastUpdatedAt?.toISOString() || new Date().toISOString();

    await prisma.apiRequestLog.create({
      data: {
        endpoint: `/api/park/${parkId}`,
        parkId,
        ipAddress,
        userAgent,
        referer,
        statusCode: 200,
      },
    });

    const parkLiveData: ParkLiveData = {
      identifier: park.identifier,
      name: park.name,
      timezone: park.timezone,
      cover: normalizeCover(park.cover),
      queueTypeLabels: park.queueTypeLabels as Record<string, string> | null,
      openingHours: openingHours ?? [],
      waitTimes,
      shows: showTimes ?? [],
      lastUpdate,
    };

    return NextResponse.json({
      success: true,
      message: `Park data for ${park.name} retrieved successfully`,
      disclaimer:
        "This data is provided by the TWTS (Thrills Wait Times Service) and is strictly intended for authorized use only. Access and usage are exclusively permitted for thrills.world and queue-park.com. Any unauthorized access, use, reproduction, or distribution is strictly prohibited. If you wish to use or integrate this data, you must obtain prior written permission by contacting contact@queue-park.com. Unauthorized usage may result in immediate actions including permanent IP banning and revocation of access without notice. We actively monitor access to ensure compliance. By accessing this data, you agree to these terms.",
      data: parkLiveData,
      counts: {
        waitTimes: waitTimes.length,
        openingHours: openingHours.length,
        showTimes: showTimes.length,
      },
    });
  } catch (error) {
    console.error(`Error serving wait times for park ${parkId}`, error);

    try {
      const prisma = getPrisma();
      await prisma.apiRequestLog.create({
        data: {
          endpoint: `/api/park/${parkId}`,
          parkId,
          ipAddress,
          userAgent,
          referer,
          statusCode: 500,
        },
      });
    } catch (logError) {
      console.error("Failed to log API request", logError);
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to retrieve wait times",
      },
      { status: 500 },
    );
  }
}
