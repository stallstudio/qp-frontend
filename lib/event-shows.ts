import { getPrisma } from "./prisma";
import { readBanner, readPoiVenue, readPoiZone } from "@/lib/poi-banner";
import { readPoiFearLevel, readPoiPrice } from "@/lib/poi-facts";
import type { ShowTime } from "@/types/show";

/**
 * Les spectacles d'un événement qui n'ont AUCUNE séance aujourd'hui, rendus
 * comme des `ShowTime` sans créneau.
 *
 * ⚠️ **Pourquoi ils existent** : le front ne connaissait un spectacle que par
 * ses séances (`show_times`). Or certaines sources publient leurs maisons
 * hantées sans le moindre horaire — Bellewaerde, relevé le 2026-10-07 : cinq
 * maisons, chacune avec son prix et son niveau de peur, et rien dans les
 * horaires. Elles n'apparaissaient nulle part. Elles vivent maintenant dans la
 * carte de leur événement, sous la grille des séances.
 *
 * ⚠️ **Seulement les événements AFFICHÉS** (`eventIds`, ceux que
 * `getParkEventsByDate` a retenus) : un spectacle de Noël n'a rien à faire sur
 * la page en octobre, la carte de Noël n'y étant pas.
 *
 * ⚠️ **`scheduledPoiIds` porte les séances AVANT `limitShowsToSessions`** : un
 * spectacle dont toutes les séances sont tombées hors des sessions du jour a
 * pourtant un horaire — il ne doit pas réapparaître ici en « sans horaire ».
 *
 * Les POI désactivés dans l'admin sont écartés, comme dans `poi_hours`. Rend
 * une liste vide sur toute erreur : c'est un complément, pas le cœur de la page.
 */
export async function getUnscheduledEventShows(
  parkId: number,
  eventIds: number[],
  scheduledPoiIds: ReadonlySet<number>,
): Promise<ShowTime[]> {
  if (eventIds.length === 0) return [];
  try {
    const pois = await getPrisma().poi.findMany({
      where: {
        parkId,
        kind: "show",
        active: true,
        eventId: { in: eventIds },
      },
      select: {
        id: true,
        name: true,
        duration: true,
        eventId: true,
        additionalData: true,
      },
      orderBy: { name: "asc" },
    });

    return pois
      .filter((poi) => !scheduledPoiIds.has(poi.id))
      .map((poi) => ({
        poiId: poi.id,
        showName: poi.name,
        duration: poi.duration ?? 0,
        eventId: poi.eventId,
        banner: readBanner(poi.additionalData),
        zone: readPoiZone(poi.additionalData),
        venue: readPoiVenue(poi.additionalData),
        fearLevel: readPoiFearLevel(poi.additionalData),
        price: readPoiPrice(poi.additionalData),
        schedules: [],
      }));
  } catch (error) {
    console.error(`Failed to load unscheduled event shows for park ${parkId}`, error);
    return [];
  }
}
