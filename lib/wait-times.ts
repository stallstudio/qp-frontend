import { WaitTime } from "@/types/waitTime";
import { getPrisma } from "./prisma";

// Tolérance entre la dernière update globale du parc et le dernier
// rafraîchissement d'un ride spécifique. Si un ride n'a pas été "vu"
// depuis (park.lastUpdatedAt - STALE_WAIT_TIME_MS), on le considère
// orphelin (API ne le renvoie plus : démolition, bug provider, etc.).
//
// La référence temporelle est `park.lastUpdatedAt` et non `Date.now()`
// afin de tolérer une panne totale de l'API du parc : si le cron ne
// met plus le parc à jour, on continue d'afficher les dernières
// données connues plutôt que tout faire disparaître.
const STALE_WAIT_TIME_MS = 30 * 24 * 60 * 60 * 1000;

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

    return Array.from(rideMap.values());
  } catch (error) {
    return [];
  }
}
