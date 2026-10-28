import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/ip-rules";
import {
  dispatchFetchForViewer,
  logParkRequest,
  relay,
} from "@/lib/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Données live d'un parc, servies par l'API Dispatch (`/v1/parks/{parc}/live`)
 * telles quelles : blacklist, 404, `nextUpdateIn` compris.
 *
 * Cette route ne sert pas au PREMIER affichage (le composant serveur de la page
 * appelle `buildParkLiveDataForViewer`) mais au **rafraîchissement
 * automatique** côté client, à la cadence que la réponse annonce.
 *
 * ⚠️ **C'est ICI que la consultation est journalisée**, et pas par l'API : elle
 * seule sait que l'appel sert la route `/api/park/{parc}`. Chaque réponse
 * compte, 403 et 404 compris — le classement des parcs populaires ne retient
 * que les 200.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ parkId: string }> },
) {
  const { parkId } = await params;

  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent");

  // Le journal n'est JAMAIS attendu : la réponse ne doit pas dépendre d'un INSERT.
  const log = (statusCode: number) =>
    logParkRequest({
      endpoint: `/api/park/${parkId}`,
      parkId,
      ipAddress,
      userAgent,
      referer: request.headers.get("referer"),
      statusCode,
    });

  try {
    // Repli admin compris : sans lui, le rafraîchissement automatique d'un parc
    // masqué recevrait un 404 et le client renverrait à l'accueil (cf.
    // `fetchParkData` dans park-page-client) — la page s'ouvrirait pour se
    // refermer soixante secondes plus tard.
    const response = await dispatchFetchForViewer(
      `/v1/parks/${encodeURIComponent(parkId)}/live`,
      { viewer: { ip: ipAddress, userAgent } },
    );
    log(response.status);
    return relay(response);
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
