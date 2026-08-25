import { ShowTime } from "@/types/show";
import { getPrisma } from "./prisma";
import { readBanner } from "@/lib/poi-banner";

/**
 * Créneaux d'un parc pour une ou plusieurs dates de RANGEMENT.
 *
 * ⚠️ **Plusieurs dates, parce que la date d'une ligne n'est pas la journée
 * d'exploitation.** Les sources datent un créneau au calendrier du fuseau du
 * parc : une nocturne 19:00 → 01:00 range donc ses dernières représentations
 * sous le lendemain. Charger la seule date logique les faisait disparaître de la
 * grille au moment précis où on les regardait — passé minuit, en pleine séance.
 *
 * Le tri définitif se fait ensuite sur les horaires, pas sur la date :
 * `limitShowsToSessions` (voir `lib/show-window.ts`) ne garde que les créneaux
 * qui tombent dans une séance du jour. Cette fonction ratisse donc large,
 * volontairement.
 */
export async function getShowTimesByParkAndDates(
  parkId: number,
  dates: string[],
): Promise<ShowTime[]> {
  try {
    const prisma = getPrisma();

    const showTimes = await prisma.showTime.findMany({
      where: {
        parkId,
        date: { in: dates },
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
