import { TimeSlot, WaitTime } from "@/types/waitTime";
import { getPrisma } from "./prisma";

function parseTimeSlot(raw: unknown): TimeSlot | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as { start?: unknown; end?: unknown };
  if (typeof obj.start !== "string" || typeof obj.end !== "string") return null;
  return { start: obj.start, end: obj.end };
}

// Tolérance entre la dernière update globale du parc et le dernier
// rafraîchissement d'un ride spécifique. Si un ride n'a pas été "vu"
// depuis (park.lastUpdatedAt - STALE_WAIT_TIME_MS), on le considère
// orphelin (API ne le renvoie plus : démolition, bug provider, etc.).
//
// La référence temporelle est `park.lastUpdatedAt` et non `Date.now()`
// afin de tolérer une panne totale de l'API du parc : si le cron ne
// met plus le parc à jour, on continue d'afficher les dernières
// données connues plutôt que tout faire disparaître.
//
// ⚠️ **3 jours et non 7** (2026-08-19). Le délai ne protège PAS d'une panne
// globale — dans ce cas `park.lastUpdatedAt` se fige aussi, donc `freshSince`
// se fige avec lui et les données restent visibles quoi qu'il arrive. Il ne
// joue que sur les entités qui disparaissent du flux PENDANT que le reste
// continue d'être mis à jour, c'est-à-dire exactement le cas saisonnier.
//
// Mesuré sur Mirabilandia : son fetcher exclut délibérément les huit
// attractions Halloween hors saison (`waitTimesService.ts`), mais cesser de les
// émettre ne CLÔT pas leurs lignes `wait_times` — `saveWaitTimes` ne ferme un
// intervalle que sur un changement d'état. Leurs lignes gardent donc
// `endTime IS NULL` avec un `lastSeenAt` figé au dernier jour de l'événement
// (2026-08-16), et à 7 jours elles s'affichaient encore « Fermé » sur la page
// du parc trois jours après la fin de l'événement.
const STALE_WAIT_TIME_MS = 3 * 24 * 60 * 60 * 1000;

export async function getLatestWaitTimesByPark(
  parkId: number,
  parkLastUpdatedAt: Date | null,
): Promise<WaitTime[]> {
  try {
    const prisma = getPrisma();

    // Référence temporelle : lastUpdatedAt du parc si connu, sinon now.
    // Fallback sur now() uniquement pour un parc qui n'aurait jamais
    // été fetché (edge case, ne devrait pas concerner les parcs display=true).
    const reference = parkLastUpdatedAt ?? new Date();
    const freshSince = new Date(reference.getTime() - STALE_WAIT_TIME_MS);

    const activeWaitTimes = await prisma.waitTime.findMany({
      where: {
        parkId,
        endTime: null,
        rideId: {
          not: null,
        },
        lastSeenAt: { gte: freshSince },
      },
      include: { ride: true },
      orderBy: [{ rideId: "asc" }, { type: "asc" }],
    });

    // Grouper les wait times par ride
    const rideMap = new Map<number, WaitTime>();

    activeWaitTimes.forEach((wt) => {
      const rideId = wt.rideId!;
      const rideName = wt.ride?.name || "Unknown";

      if (!rideMap.has(rideId)) {
        rideMap.set(rideId, {
          rideId,
          rideName,
          // Sans requête supplémentaire : `include: { ride: true }` ci-dessus
          // ramène déjà la ligne complète de l'attraction.
          eventId: wt.ride?.eventId ?? null,
          queues: [],
        });
      }

      rideMap.get(rideId)!.queues.push({
        type: wt.type,
        waitTime: wt.waitTime,
        status: wt.status,
        timeSlot: parseTimeSlot(wt.timeSlot),
      });
    });

    return Array.from(rideMap.values());
  } catch (error) {
    return [];
  }
}
