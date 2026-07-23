import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { isBlacklisted } from "@/lib/ip-rules";
import { buildRideHistory } from "@/lib/wait-times-history";
import { sampleDaySeries, type TimedPoint } from "@/lib/wait-times-forecast";
import type { ConfidenceLevel, RideHistoryResponse } from "@/types/rideHistory";

// Cadence d'échantillonnage (min) de la courbe du jour ET de la prévision.
const CHART_STEP_MINUTES = 15;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Historique du jour + prévision de fin de journée pour UNE attraction (file
 * standby). Fetché à la demande à l'ouverture du popup d'une attraction — donc
 * indépendant de l'historique global (suspendu). Reconstruit une série
 * horodatée depuis le modèle temporel `wait_times` et applique la stratégie de
 * prévision active.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ parkId: string; rideId: string }> },
) {
  const { parkId, rideId } = await params;

  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0] ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const emptyData = (timezone: string): RideHistoryResponse => ({
    timezone,
    window: null,
    now: new Date().toISOString(),
    today: [],
    forecast: [],
    meta: {
      scale: 1,
      confidence: 0,
      confidenceLevel: "low",
      preOpening: false,
      method: "none",
      historyDays: 0,
      chronicallyUnavailable: false,
    },
  });

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

    const rideIdNum = Number(rideId);
    if (!Number.isInteger(rideIdNum)) {
      return NextResponse.json({ error: "Invalid ride id" }, { status: 400 });
    }

    // Vérifie l'appartenance de l'attraction au parc (anti-fuite cross-parc).
    const ride = await prisma.ride.findFirst({
      where: { id: rideIdNum, parkId: park.id },
      select: { id: true },
    });
    if (!ride) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // La prévision est PRÉCALCULÉE par le worker (table ride_forecast). Ici on
    // ne reconstruit que la courbe OBSERVÉE du jour (live) ; l'historique n'est
    // donc plus nécessaire (historyDays: 0).
    const rideHistory = await buildRideHistory(park.id, park.timezone, rideIdNum, {
      historyDays: 0,
    });

    if (!rideHistory.today) {
      return NextResponse.json({ data: emptyData(park.timezone) });
    }

    const today = sampleDaySeries(
      rideHistory.today,
      rideHistory.now,
      CHART_STEP_MINUTES,
    );

    // Prévision stockée : on ne l'utilise que si elle vise bien le jour logique
    // courant (sinon elle est périmée -> on n'affiche pas de prévision).
    const forecastRow = await prisma.rideForecast.findUnique({
      where: { rideId: rideIdNum },
      select: {
        date: true,
        forecast: true,
        scale: true,
        confidence: true,
        confidenceLevel: true,
        preOpening: true,
        method: true,
        baseProfile: true,
      },
    });

    const fresh = forecastRow && forecastRow.date === rideHistory.date;
    const forecast: TimedPoint[] = fresh
      ? ((forecastRow.forecast as unknown as TimedPoint[]) ?? [])
      : [];
    const baseProfile =
      fresh &&
      forecastRow.baseProfile &&
      typeof forecastRow.baseProfile === "object"
        ? (forecastRow.baseProfile as {
            historyDays?: number;
            availabilityRatio?: number;
          })
        : null;
    const historyDays = baseProfile ? Number(baseProfile.historyDays ?? 0) : 0;
    // Attraction « indisponible en permanence » : ouverte moins d'~20 % du temps
    // pendant les heures d'ouverture sur l'historique (même seuil que le worker).
    const availabilityRatio = baseProfile
      ? Number(baseProfile.availabilityRatio ?? 1)
      : 1;
    const chronicallyUnavailable = fresh ? availabilityRatio < 0.2 : false;

    const data: RideHistoryResponse = {
      timezone: rideHistory.timezone,
      window: {
        open: rideHistory.today.open.toISOString(),
        close: rideHistory.today.close.toISOString(),
      },
      now: rideHistory.now.toISOString(),
      today,
      forecast,
      meta: {
        scale: fresh ? forecastRow.scale : 1,
        confidence: fresh ? forecastRow.confidence : 0,
        confidenceLevel: fresh
          ? (forecastRow.confidenceLevel as ConfidenceLevel)
          : "low",
        preOpening: fresh ? forecastRow.preOpening : false,
        method: fresh ? forecastRow.method : "none",
        historyDays,
        chronicallyUnavailable,
      },
    };

    return NextResponse.json({ data });
  } catch (error) {
    console.error(
      `Error serving ride history for park ${parkId} ride ${rideId}`,
      error,
    );
    return NextResponse.json({ data: emptyData("") }, { status: 200 });
  }
}
