import { subscribeToPark } from "@/lib/park-updates";
import { getParkIdentity } from "@/lib/park-live-data";
import {
  getClientIp,
  isBlacklisted,
  isUserAgentBlacklisted,
} from "@/lib/ip-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Flux « du nouveau pour ce parc » (Server-Sent Events).
 *
 * ⚠️ **Ce flux ne transporte AUCUNE donnée de parc**, seulement l'horodatage de
 * la dernière collecte. À sa réception, le client refait son appel habituel à
 * `/api/park/{parkId}` : le journal des consultations continue donc d'alimenter
 * le classement des parcs populaires, et la forme des données reste définie au
 * seul endroit qui la connaît. Voir `lib/park-updates.ts`.
 *
 * ⚠️ **SSE et non WebSocket** : le client n'a rien à dire, il écoute. Un flux
 * unidirectionnel se reconnecte tout seul (`EventSource`), traverse les proxies
 * sans configuration et coûte une route HTTP ordinaire ; le duplex n'apporterait
 * ici que son protocole et ses sessions collantes.
 *
 * ⚠️ **Le décompte du client n'est pas remplacé, il est doublé.** Sur le réseau
 * d'un parc, une connexion longue tombe régulièrement — c'est le cas normal, pas
 * l'exception. `useAutoRefresh` continue de tourner en filet.
 */

/** Battement de cœur. Sans trafic, un proxy mobile ou un frontal ferme une
 *  connexion inactive au bout d'une minute environ, et le client ne l'apprend
 *  qu'à la prochaine écriture — c'est-à-dire trop tard. Vingt secondes passent
 *  partout. Le commentaire SSE (`:`) est ignoré par `EventSource`. */
const HEARTBEAT_MS = 20_000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ parkId: string }> },
) {
  const { parkId } = await params;

  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent");
  if ((await isBlacklisted(ipAddress)) || (await isUserAgentBlacklisted(userAgent))) {
    return new Response("Forbidden", { status: 403 });
  }

  // ⚠️ **Vérification indispensable, et pas seulement pour la politesse du 404.**
  // Le guetteur interroge la base avec la liste des parcs écoutés : sans ce
  // filtre, n'importe qui pourrait y faire entrer des milliers d'identifiants
  // inventés et gonfler la requête pour tout le monde.
  const park = await getParkIdentity(parkId);
  if (park == null) {
    return new Response("Not found", { status: park === null ? 404 : 503 });
  }

  const since = new URL(request.url).searchParams.get("since");

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let unsubscribe: (() => void) | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Le client est parti entre-temps : rien à signaler, on range.
          cleanup();
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          // Déjà fermé par l'abandon du client.
        }
      };

      // Envoyé tout de suite : c'est ce premier octet qui fait basculer
      // `EventSource` en état « ouvert » côté navigateur, et qui traverse les
      // proxies qui attendent des données avant de laisser passer la réponse.
      write(`retry: 10000\nevent: ready\ndata: ${park.identifier}\n\n`);

      unsubscribe = subscribeToPark(parkId, since, (lastUpdate) => {
        write(`event: update\ndata: ${lastUpdate}\n\n`);
      });

      heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);
      heartbeat.unref?.();

      request.signal.addEventListener("abort", cleanup);
      if (request.signal.aborted) cleanup();
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // ⚠️ Sans cet en-tête, un frontal qui tamponne la réponse retient le flux
      // et ne le délivre qu'à la fermeture : le direct ne marche pas, et rien
      // dans les journaux ne dit pourquoi.
      "X-Accel-Buffering": "no",
    },
  });
}
