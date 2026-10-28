import { getClientIp } from "@/lib/ip-rules";
import { dispatchFetch, relay } from "@/lib/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Flux « du nouveau pour ce parc » (Server-Sent Events), relayé depuis l'API
 * Dispatch (`/v1/parks/{parc}/stream`) : blacklist, 404 et battement de cœur
 * compris.
 *
 * ⚠️ **Ce flux ne transporte AUCUNE donnée de parc**, seulement l'horodatage de
 * la dernière collecte. À sa réception, le client refait son appel habituel à
 * `/api/park/{parkId}` : le journal des consultations continue donc d'alimenter
 * le classement des parcs populaires.
 *
 * ⚠️ **Le signal d'abandon est transmis** : quand le navigateur ferme le flux,
 * la connexion vers l'API se ferme avec lui, et l'API cesse de guetter ce parc
 * pour lui.
 *
 * ⚠️ **Le décompte du client n'est pas remplacé, il est doublé.** Sur le réseau
 * d'un parc, une connexion longue tombe régulièrement — c'est le cas normal, pas
 * l'exception. `useAutoRefresh` continue de tourner en filet.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ parkId: string }> },
) {
  const { parkId } = await params;
  const since = new URL(request.url).searchParams.get("since");

  try {
    return relay(
      await dispatchFetch(
        `/v1/parks/${encodeURIComponent(parkId)}/stream` +
          (since === null ? "" : `?since=${encodeURIComponent(since)}`),
        {
          viewer: {
            ip: getClientIp(request),
            userAgent: request.headers.get("user-agent"),
          },
          signal: request.signal,
        },
      ),
    );
  } catch (error) {
    if (!request.signal.aborted) {
      console.error(`Park stream unavailable: ${parkId}`, error);
    }
    return new Response("Not found", { status: 503 });
  }
}
