import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getClientIp, isBlacklisted } from "@/lib/ip-rules";
import { logParkRequest } from "@/lib/api-request-log";
import { BLOCKED_ERROR, BLOCKED_MESSAGE } from "@/lib/api-disclaimer";
import { buildRideHistory } from "@/lib/wait-times-history";
import { sampleDaySeries, type TimedPoint } from "@/lib/wait-times-series";
import type { ConfidenceLevel, RideHistoryResponse } from "@/types/rideHistory";

// Cadence d'échantillonnage (min) de la courbe du jour ET de la prévision.
const CHART_STEP_MINUTES = 15;

// Nombre de journées d'OBSERVATION minimum avant d'oser qualifier une
// attraction de « ne publie pas de temps d'attente » (message dédié + alertes
// désactivées).
const MIN_OBSERVED_DAYS_FOR_UNAVAILABLE = 3;

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

  const ipAddress = getClientIp(request);

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
      marginMinutes: null,
      marginSamples: 0,
    },
  });

  try {
    const prisma = getPrisma();

    if (await isBlacklisted(ipAddress)) {
      // ⚠️ **Cette route ne journalise QUE le 403, jamais ses réponses
      // normales**, et l'asymétrie est voulue. `api_request_logs` alimente le
      // classement des parcs populaires (`getPopularParkIdentifiers`), qui ne
      // compte que les `statusCode: 200` : un 403 ne peut donc pas le fausser,
      // alors que journaliser les succès d'ici l'aurait faussé aussitôt — le
      // popup d'attraction se rouvre bien plus souvent qu'on ne change de parc,
      // et ce trafic serait venu s'ajouter à celui de la route parc.
      //
      // Ce qu'on veut voir, c'est une IP bloquée qui CONTINUE de cogner : sans
      // cette ligne elle disparaissait du journal au moment même où elle
      // devenait intéressante, et rien ne disait si un blocage avait servi.
      // `parkId` est renseigné, donc la ventilation par parc de la page
      // Requests continue de fonctionner comme avant.
      logParkRequest({
        endpoint: `/api/park/${parkId}/ride/${rideId}/history`,
        parkId,
        ipAddress,
        userAgent: request.headers.get("user-agent"),
        referer: request.headers.get("referer"),
        statusCode: 403,
      });
      return NextResponse.json(
        { error: BLOCKED_ERROR, message: BLOCKED_MESSAGE },
        { status: 403 },
      );
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
    //
    // ⚠️ `kind: "ride"` fait partie du contrôle depuis que les spectacles
    // partagent la table : sans lui, l'identifiant d'un spectacle ouvrirait la
    // page « historique d'attraction » d'une entité qui n'a pas de file.
    const ride = await prisma.poi.findFirst({
      where: { kind: "ride", id: rideIdNum, parkId: park.id },
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
      where: { poiId: rideIdNum },
      select: {
        date: true,
        forecast: true,
        scale: true,
        confidence: true,
        confidenceLevel: true,
        preOpening: true,
        method: true,
        baseProfile: true,
        marginMinutes: true,
        marginSamples: true,
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
            observedDays?: number;
            availabilityRatio?: number;
          })
        : null;
    const historyDays = baseProfile ? Number(baseProfile.historyDays ?? 0) : 0;
    // Attraction « indisponible en permanence » : ouverte moins d'~20 % du temps
    // pendant les heures d'ouverture sur l'historique (même seuil que le worker).
    const availabilityRatio = baseProfile
      ? Number(baseProfile.availabilityRatio ?? 1)
      : 1;
    // ...mais ce verdict n'a de sens qu'avec assez d'observation pour l'appuyer.
    //
    // ⚠️ Le garde-fou porte sur `observedDays` (journées où l'attraction a été
    // VUE, ouverte ou non) et surtout PAS sur `historyDays` (journées où elle a
    // été disponible au moins une fois). La première version testait
    // `historyDays >= 3` et s'annulait elle-même : une attraction qui n'affiche
    // JAMAIS de temps d'attente (Eurosat Coastiality) a par construction
    // `historyDays = 0`, donc elle échappait au verdict et laissait créer des
    // alertes qui ne se déclencheraient jamais. `observedDays` sépare bien les
    // deux cas : parc fraîchement ajouté -> 0 (on ne conclut rien) ; attraction
    // suivie depuis des semaines sans jamais publier d'attente -> élevé.
    const observedDays = baseProfile ? Number(baseProfile.observedDays ?? 0) : 0;
    const chronicallyUnavailable =
      !!fresh &&
      observedDays >= MIN_OBSERVED_DAYS_FOR_UNAVAILABLE &&
      availabilityRatio < 0.2;

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
        // Marge d'erreur MESURÉE (moyenne des écarts prévu/observé des jours
        // précédents). Remplace l'ancien indice de « fiabilité », qui ne
        // mesurait qu'un volume de données et affichait « haute » dès 7 jours
        // d'historique sans jamais confronter la prévision au réel.
        marginMinutes: fresh ? forecastRow.marginMinutes : null,
        marginSamples: fresh ? (forecastRow.marginSamples ?? 0) : 0,
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
