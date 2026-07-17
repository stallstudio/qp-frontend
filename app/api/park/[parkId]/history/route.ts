import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { getPrisma } from "@/lib/prisma";
import { calculateParkDate } from "@/lib/opening-hours";
import { isBlacklisted } from "@/lib/ip-rules";

// Nombre max de points renvoyés par attraction (on garde les plus récents).
const MAX_POINTS = 120;

/**
 * Historique des temps d'attente "standby" du jour, par attraction.
 * Exploite le modèle temporel de `wait_times` : chaque changement d'état crée
 * une ligne (startTime -> endTime), la valeur courante ayant endTime = null.
 * On renvoie la suite ordonnée des valeurs pour alimenter les sparklines.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ parkId: string }> },
) {
  const { parkId } = await params;

  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0] ??
    request.headers.get("x-real-ip") ??
    "unknown";

  try {
    const prisma = getPrisma();

    if (await isBlacklisted(ipAddress)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const park = await prisma.park.findUnique({
      where: { identifier: parkId, display: true },
      select: { id: true, timezone: true },
    });

    if (!park) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const today = await calculateParkDate(park.id, park.timezone);
    if (!today) {
      return NextResponse.json({ data: {} });
    }

    const dayStart = DateTime.fromISO(today, { zone: park.timezone })
      .startOf("day")
      .toUTC()
      .toJSDate();

    const rows = await prisma.waitTime.findMany({
      where: {
        parkId: park.id,
        type: "standby",
        rideId: { not: null },
        startTime: { gte: dayStart },
      },
      select: { rideId: true, waitTime: true },
      orderBy: [{ rideId: "asc" }, { startTime: "asc" }],
    });

    const history: Record<number, number[]> = {};
    for (const row of rows) {
      const rideId = row.rideId!;
      if (!history[rideId]) history[rideId] = [];
      history[rideId].push(row.waitTime);
    }

    // On borne le nombre de points par attraction (on conserve les plus récents).
    for (const rideId of Object.keys(history)) {
      const arr = history[Number(rideId)];
      if (arr.length > MAX_POINTS) {
        history[Number(rideId)] = arr.slice(arr.length - MAX_POINTS);
      }
    }

    return NextResponse.json({ data: history });
  } catch (error) {
    console.error(`Error serving wait time history for park ${parkId}`, error);
    return NextResponse.json({ data: {} }, { status: 200 });
  }
}
