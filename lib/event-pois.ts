import { getPrisma } from "./prisma";
import { readBanner, readPoiVenue, readPoiZone } from "@/lib/poi-banner";
import { readPoiFearLevel, readPoiPrice } from "@/lib/poi-facts";
import type { ShowTime } from "@/types/show";
import type { WaitTime } from "@/types/waitTime";

/**
 * Les POI d'un événement affiché que leur liste ne montrerait pas : les
 * spectacles sans AUCUNE séance aujourd'hui, les attractions sans temps
 * d'attente vivant. Rendus dans la forme de leur liste — `ShowTime` sans
 * créneau, `WaitTime` sans file — pour ouvrir le même popup.
 *
 * ⚠️ **Pourquoi ils existent** : le front ne connaissait un spectacle que par
 * ses séances, une attraction que par ses temps d'attente. Or certaines sources
 * publient leurs maisons hantées sans l'un ni l'autre — Bellewaerde, relevé le
 * 2026-10-07 : cinq maisons avec leur prix et leur niveau de peur, et rien dans
 * les horaires. Elles n'apparaissaient nulle part.
 *
 * ⚠️ **Seulement les événements AFFICHÉS** (`eventIds`, ceux que
 * `getParkEventsByDate` a retenus). Une édition est une LIGNE par saison, et le
 * worker ne migre vers la nouvelle que les POI que la source déclare encore :
 * une maison retirée du catalogue reste attachée à l'édition passée, et ne
 * revient donc pas l'année suivante.
 *
 * ⚠️ **`scheduledShowIds` porte les séances AVANT `limitShowsToSessions`** : un
 * spectacle dont toutes les séances sont tombées hors des sessions du jour a
 * pourtant un horaire — il ne doit pas réapparaître ici en « sans horaire ».
 *
 * Les POI désactivés dans l'admin sont écartés, comme dans `poi_hours`. Rend
 * des listes vides sur toute erreur : c'est un complément, pas le cœur de la
 * page.
 */
export async function getEventPoisWithoutData(
  parkId: number,
  eventIds: number[],
  scheduledShowIds: ReadonlySet<number>,
  liveRideIds: ReadonlySet<number>,
): Promise<{ unscheduledShows: ShowTime[]; unlistedRides: WaitTime[] }> {
  const empty = { unscheduledShows: [], unlistedRides: [] };
  if (eventIds.length === 0) return empty;
  try {
    const pois = await getPrisma().poi.findMany({
      where: {
        parkId,
        kind: { in: ["show", "ride"] },
        active: true,
        eventId: { in: eventIds },
      },
      select: {
        id: true,
        kind: true,
        name: true,
        duration: true,
        eventId: true,
        additionalData: true,
      },
      orderBy: { name: "asc" },
    });

    const unscheduledShows: ShowTime[] = pois
      .filter((poi) => poi.kind === "show" && !scheduledShowIds.has(poi.id))
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

    const unlistedRides: WaitTime[] = pois
      .filter((poi) => poi.kind === "ride" && !liveRideIds.has(poi.id))
      .map((poi) => ({
        rideId: poi.id,
        rideName: poi.name,
        queues: [],
        eventId: poi.eventId,
        banner: readBanner(poi.additionalData),
        kind: "ride",
        zone: readPoiZone(poi.additionalData),
        // Comme `getLatestWaitTimesByPark` : jamais de menu sur une attraction.
        menu: null,
        fearLevel: readPoiFearLevel(poi.additionalData),
        price: readPoiPrice(poi.additionalData),
      }));

    return { unscheduledShows, unlistedRides };
  } catch (error) {
    console.error(`Failed to load event POIs for park ${parkId}`, error);
    return empty;
  }
}
