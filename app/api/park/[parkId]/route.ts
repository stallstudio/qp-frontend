import { NextResponse } from "next/server";
import { buildParkLiveData } from "@/lib/park-live-data";
import { isBlacklisted } from "@/lib/ip-rules";
import { logParkRequest } from "@/lib/api-request-log";
import { DATA_DISCLAIMER } from "@/lib/api-disclaimer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Données live d'un parc.
 *
 * Depuis le passage de la page parc en rendu serveur, cette route ne sert plus
 * au PREMIER affichage (le composant serveur appelle `buildParkLiveData`
 * directement) mais au **rafraîchissement automatique** côté client, toutes les
 * 60 s. La logique métier est partagée : une seule définition de ce qu'est
 * « l'état d'un parc ».
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
  const userAgent = request.headers.get("user-agent");
  const referer = request.headers.get("referer");
  const endpoint = `/api/park/${parkId}`;

  // Le journal alimente le classement des parcs populaires. Il n'est JAMAIS
  // attendu : la réponse ne doit pas dépendre d'un INSERT (voir lib/api-request-log).
  const log = (statusCode: number) =>
    logParkRequest({
      endpoint,
      parkId,
      ipAddress,
      userAgent,
      referer,
      statusCode,
    });

  try {
    if (await isBlacklisted(ipAddress)) {
      log(403);
      return NextResponse.json(
        {
          error: "Forbidden",
          message:
            "Your IP address has been blocked. If you believe this is an error, contact contact@queue-park.com.",
        },
        { status: 403 },
      );
    }

    const result = await buildParkLiveData(parkId);

    if (result.status === "not-found") {
      log(404);
      return NextResponse.json(
        { error: "Not found", message: `Park not found: ${parkId}` },
        { status: 404 },
      );
    }

    if (result.status === "error") {
      log(500);
      return NextResponse.json(
        { error: "Internal server error", message: result.reason },
        { status: 500 },
      );
    }

    log(200);

    return NextResponse.json(
      {
        success: true,
        message: `Park data for ${result.data.name} retrieved successfully`,
        disclaimer: DATA_DISCLAIMER,
        data: result.data,
        counts: {
          waitTimes: result.data.waitTimes.length,
          openingHours: result.data.openingHours.length,
          showTimes: result.data.shows.length,
        },
      },
      {
        headers: {
          // PAS de cache partagé, volontairement : chaque appel alimente le
          // journal qui sert à calculer les « parcs populaires ». Une réponse
          // servie depuis un CDN ne serait jamais comptée et fausserait le
          // classement (sans parler de la fraîcheur des temps d'attente).
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error(`Error serving wait times for park ${parkId}`, error);
    log(500);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to retrieve wait times",
      },
      { status: 500 },
    );
  }
}
