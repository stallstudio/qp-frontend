import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { calculateParkDate } from "@/lib/opening-hours";

type QueueTime = {
  type: string;
  waitTime: number;
  status: string;
};

type SimplifiedWaitTime = {
  rideName: string;
  queues: QueueTime[];
};

type SimplifiedOpeningHours = {
  type: string;
  openTime: Date | null;
  closeTime: Date | null;
};

type ShowSchedule = {
  startTime: string;
  endTime: string | null;
};

type SimplifiedShowTime = {
  showName: string;
  duration: number;
  schedules: ShowSchedule[];
};

type ParkData = {
  identifier: string;
  name: string;
  timezone: string;
  cover: string[] | null;
  queueTypeLabels: Record<string, string> | null;
  openingHours: SimplifiedOpeningHours[];
  waitTimes: SimplifiedWaitTime[];
  shows: SimplifiedShowTime[];
  lastUpdate: string | null;
};

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

    const [activeWaitTimes, openingHours, showTimes] = await Promise.all([
      prisma.waitTime.findMany({
        where: {
          parkId: park.id,
          endTime: null,
        },
        include: {
          ride: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          startTime: "desc",
        },
      }),
      prisma.openingHours.findMany({
        where: {
          parkId: park.id,
          date: today,
        },
        select: {
          type: true,
          openTime: true,
          closeTime: true,
        },
        orderBy: {
          type: "asc",
        },
      }),
      prisma.showTime.findMany({
        where: {
          parkId: park.id,
          date: today,
        },
        include: {
          show: {
            select: {
              id: true,
              name: true,
              duration: true,
            },
          },
        },
        orderBy: {
          startTime: "asc",
        },
      }),
    ]);

    // Group wait times by ride
    const rideMap = new Map<number, SimplifiedWaitTime>();

    activeWaitTimes.forEach((wt) => {
      const rideId = wt.rideId!;
      const rideName = wt.ride?.name || "Unknown";

      if (!rideMap.has(rideId)) {
        rideMap.set(rideId, {
          rideName,
          queues: [],
        });
      }

      rideMap.get(rideId)!.queues.push({
        type: wt.type,
        waitTime: wt.waitTime,
        status: wt.status,
      });
    });

    const waitTimes: SimplifiedWaitTime[] = Array.from(rideMap.values());

    // Group show times by show
    const showsMap = new Map<string, SimplifiedShowTime>();

    for (const st of showTimes) {
      const externalId = st.externalId;

      if (!showsMap.has(externalId)) {
        showsMap.set(externalId, {
          showName: st.show?.name ?? "Unknown",
          duration: st.show?.duration ?? 0,
          schedules: [],
        });
      }

      showsMap.get(externalId)!.schedules.push({
        startTime: st.startTime.toISOString(),
        endTime: st.endTime ? st.endTime.toISOString() : null,
      });
    }

    const shows: SimplifiedShowTime[] = Array.from(showsMap.values());

    const lastUpdate = park.lastUpdatedAt?.toISOString() || null;

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

    const parkData: ParkData = {
      identifier: park.identifier,
      name: park.name,
      timezone: park.timezone,
      cover: park.cover as string[] | null,
      queueTypeLabels: park.queueTypeLabels as Record<string, string> | null,
      openingHours: openingHours ?? [],
      waitTimes,
      shows: shows ?? [],
      lastUpdate,
    };

    return NextResponse.json({
      success: true,
      message: `Park data for ${park.name} retrieved successfully`,
      disclaimer:
        "This data is provided by the TWTS (Thrills Wait Times Service) and is strictly intended for authorized use only. Access and usage are exclusively permitted for thrills.world and queue-park.com. Any unauthorized access, use, reproduction, or distribution is strictly prohibited. If you wish to use or integrate this data, you must obtain prior written permission by contacting contact@queue-park.com. Unauthorized usage may result in immediate actions including permanent IP banning and revocation of access without notice. We actively monitor access to ensure compliance. By accessing this data, you agree to these terms.",
      data: parkData,
      counts: {
        waitTimes: waitTimes.length,
        openingHours: openingHours.length,
        shows: shows.length,
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
