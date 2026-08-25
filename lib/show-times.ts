import { ShowTime } from "@/types/show";
import { getPrisma } from "./prisma";
import { readBanner } from "@/lib/poi-banner";

export async function getShowTimesByParkAndDate(
  parkId: number,
  date: string,
): Promise<ShowTime[]> {
  try {
    const prisma = getPrisma();

    const showTimes = await prisma.showTime.findMany({
      where: {
        parkId,
        date,
        poiId: {
          not: null,
        },
      },
      include: {
        poi: true,
      },
      orderBy: {
        startTime: "asc",
      },
    });

    // Grouper par externalId pour éviter de mélanger les shows non mappés
    const showsMap = new Map<string, ShowTime>();

    for (const st of showTimes) {
      const externalId = st.externalId;

      if (!showsMap.has(externalId)) {
        showsMap.set(externalId, {
          showName: st.poi?.name ?? "Unknown",
          duration: st.poi?.duration ?? 0,
          // Sans requête supplémentaire : `include: { poi: true }` ci-dessus
          // ramène déjà la ligne complète du spectacle.
          eventId: st.poi?.eventId ?? null,
          banner: readBanner(st.poi?.additionalData),
          schedules: [],
        });
      }

      showsMap.get(externalId)!.schedules.push({
        startTime: st.startTime.toISOString(),
        endTime: st.endTime ? st.endTime.toISOString() : null,
      });
    }

    return Array.from(showsMap.values());
  } catch (error) {
    return [];
  }
}
