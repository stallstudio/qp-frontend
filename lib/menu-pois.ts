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
 * ⚠️ **Seulement dans un parc où la MAJORITÉ des restaurants a une carte**
 * (arbitré le 2026-10-10). Le critère de base reste l'état ou les heures du
 * jour : une ou deux cartes sur tout un parc ne valent pas une liste de noms
 * muets. Mais là où la plupart en publient — le Parc Astérix, 12 sur 14 —, la
 * carte est une vraie information, et on liste alors TOUS les restaurants,
 * carte ou non, pour qu'aucun ne manque d'un onglet à l'autre.
 *
 * Rend `null` quand le parc ne remplit pas cette condition : l'appelant garde
 * alors le comportement de base, dans les deux onglets.
 *
 * Les POI désactivés dans l'admin sont écartés, comme dans `poi_hours`. Rend
 * une liste vide sur toute erreur : c'est un complément, pas le cœur de la
 * page.
 */
export async function getRestaurantsWithoutStatus(
  parkId: number,
  liveIds: ReadonlySet<number>,
): Promise<WaitTime[] | null> {
  try {
    const pois = await getPrisma().poi.findMany({
      where: { parkId, kind: "restaurant", active: true },
      select: { id: true, name: true, eventId: true, additionalData: true },
      orderBy: { name: "asc" },
    });

    const withMenu = pois.filter((poi) => readPoiMenu(poi.additionalData));
    if (withMenu.length * 2 <= pois.length) return null;

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
    return null;
  }
}
