import { WaitTime } from "@/types/waitTime";
import { getPrisma } from "./prisma";

export async function getLatestWaitTimesByPark(
  parkId: number,
): Promise<WaitTime[]> {
  try {
    const prisma = getPrisma();

    // Récupérer toutes les périodes actives (endTime = NULL) pour ce parc
    const activeWaitTimes = await prisma.waitTime.findMany({
      where: {
        parkId,
        endTime: null,
        rideId: {
          not: null,
        },
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
