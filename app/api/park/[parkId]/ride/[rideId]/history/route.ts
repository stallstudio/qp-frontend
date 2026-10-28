import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/ip-rules";
import {
  dispatchFetchForViewer,
  logParkRequest,
  relay,
} from "@/lib/dispatch";
import type { RideHistoryResponse } from "@/types/rideHistory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Historique du jour + prévision de fin de journée pour UNE attraction (file
 * standby, ou `?queue=singlerider`), servis par l'API Dispatch
 * (`/v1/parks/{parc}/rides/{id}/history`). Fetché à l'ouverture du popup d'une
 * attraction.
 *
 * Même repli admin que la page du parc : sans lui, le graphique resterait vide
 * sur un parc masqué, alors que la page qui l'entoure s'affiche.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ parkId: string; rideId: string }> },
) {
  const { parkId, rideId } = await params;

  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent");

  try {
    const response = await dispatchFetchForViewer(
      `/v1/parks/${encodeURIComponent(parkId)}/rides/${encodeURIComponent(rideId)}/history` +
        new URL(request.url).search,
      { viewer: { ip: ipAddress, userAgent } },
    );

    if (response.status === 403) {
      // ⚠️ **Cette route ne journalise QUE le 403, jamais ses réponses
      // normales**, et l'asymétrie est voulue. Le classement des parcs
      // populaires ne compte que les 200 : un 403 ne peut pas le fausser, alors
      // que journaliser les succès d'ici l'aurait faussé aussitôt — le popup
      // d'attraction se rouvre bien plus souvent qu'on ne change de parc.
      //
      // Ce qu'on veut voir, c'est un client bloqué qui CONTINUE de cogner : sans
      // cette ligne il disparaissait du journal au moment même où il devenait
      // intéressant.
      logParkRequest({
        endpoint: `/api/park/${parkId}/ride/${rideId}/history`,
        parkId,
        ipAddress,
        userAgent,
        referer: request.headers.get("referer"),
        statusCode: 403,
      });
    }

    return relay(response);
  } catch (error) {
    console.error(
      `Error serving ride history for park ${parkId} ride ${rideId}`,
      error,
    );
    // Un graphique vide plutôt qu'un popup en erreur.
    const data: RideHistoryResponse = {
      timezone: "",
      window: null,
      now: new Date().toISOString(),
      today: [],
      forecast: [],
      forecastTrail: [],
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
        waitCap: null,
        valueRanges: [],
      },
    };
    return NextResponse.json({ data });
  }
}
