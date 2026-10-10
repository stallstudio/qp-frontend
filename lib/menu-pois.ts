import { getPrisma } from "./prisma";
import { readBanner, readPoiMenu, readPoiZone } from "@/lib/poi-banner";
import type { WaitTime } from "@/types/waitTime";

/**
 * Les restaurants qui ne publient pas leur état : ni ligne `wait_times`
 * vivante, donc absents de la liste « Restaurants » du direct. Rendus dans la
 * forme de cette liste — `WaitTime` sans file — pour ouvrir le même popup, où
 * se lit la carte quand la source en publie une.
 *
 * ⚠️ **Pourquoi ils existent** : le front ne connaissait un restaurant que par
 * son état en direct ou ses heures du jour. Le Parc Astérix publie la carte en
 * PDF de 12 de ses 14 restaurants (paquet hors ligne, relevé le 2026-10-10),
 * mais aucun état : aucun restaurant n'apparaissait, ni leurs cartes.
 *
 * ⚠️ **TOUS, carte ou non** (arbitré le 2026-10-10) : n'en montrer qu'une
 * partie laissait croire que les autres n'existaient pas.
 *
 * Les POI désactivés dans l'admin sont écartés, comme dans `poi_hours`. Rend
 * une liste vide sur toute erreur : c'est un complément, pas le cœur de la
 * page.
 */
export async function getRestaurantsWithoutStatus(
  parkId: number,
  liveIds: ReadonlySet<number>,
): Promise<WaitTime[]> {
  try {
    const pois = await getPrisma().poi.findMany({
      where: { parkId, kind: "restaurant", active: true },
      select: { id: true, name: true, eventId: true, additionalData: true },
      orderBy: { name: "asc" },
    });

    return pois.flatMap((poi) => {
      if (liveIds.has(poi.id)) return [];
      const menu = readPoiMenu(poi.additionalData);
      return [
        {
          rideId: poi.id,
          rideName: poi.name,
          queues: [],
          eventId: poi.eventId,
          banner: readBanner(poi.additionalData),
          kind: "restaurant" as const,
          zone: readPoiZone(poi.additionalData),
          menu,
          fearLevel: null,
          price: null,
        },
      ];
    });
  } catch (error) {
    console.error(
      `Failed to load restaurants without status for park ${parkId}`,
      error,
    );
    return [];
  }
}
