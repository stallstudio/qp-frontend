import { ShowTime } from "@/types/show";
import { getPrisma } from "./prisma";

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
        showId: {
          not: null,
        },
      },
      include: {
        show: true,
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
          showName: st.show?.name ?? "Unknown",
          duration: st.show?.duration ?? 0,
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
