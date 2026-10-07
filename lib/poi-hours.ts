import { getPrisma } from "./prisma";
import { readBanner, readPoiMenu, readPoiZone } from "@/lib/poi-banner";
import { parsePoiKind } from "@/lib/poi-kinds";
import type { PoiHours } from "@/types/poiHours";

/**
 * Heures d'ouverture des POI d'un parc pour sa journée d'exploitation.
 *
 * ⚠️ **Rend une liste VIDE sur toute erreur**, y compris une table
 * `poi_hours` absente : elle est arrivée le 2026-10-06
 * (`migrations/2026-10-06-poi-hours` du worker), et un frontend déployé avant
 * la migration doit continuer d'afficher tout le reste de la page.
 *
 * ⚠️ **Les POI désactivés à la main dans l'admin sont écartés… SAUF ceux que
 * `keepInactive` désigne.** Le drapeau `active` est une ancienne curation que
 * le reste du front IGNORE : la liste des temps d'attente en affiche 209 au
 * 2026-10-07, dont Frozen Ever After. Les filtrer ici seulement retirait au
 * popup l'heure de fermeture d'une attraction pourtant affichée juste à côté.
 * Le filtre reste pour ce qui n'est montré nulle part ailleurs — Het Badhuys
 * d'Efteling publie ses heures alors qu'on a décidé de ne plus le montrer.
 */
export async function getPoiHoursByParkAndDate(
  parkId: number,
  date: string,
  keepInactive: ReadonlySet<number> = new Set(),
): Promise<PoiHours[]> {
  try {
    const prisma = getPrisma();
    const rows = await prisma.poiHours.findMany({
      where: { parkId, date },
      include: {
        poi: {
          select: {
            name: true,
            kind: true,
            active: true,
            eventId: true,
            additionalData: true,
          },
        },
      },
      orderBy: { openTime: "asc" },
    });

    const byPoi = new Map<number, PoiHours>();
    for (const row of rows) {
      if (!row.poi.active && !keepInactive.has(row.poiId)) continue;
      const kind = parsePoiKind(row.poi.kind);
      if (!kind) continue;

      let entry = byPoi.get(row.poiId);
      if (!entry) {
        entry = {
          poiId: row.poiId,
          name: row.poi.name,
          kind,
          eventId: row.poi.eventId,
          banner: readBanner(row.poi.additionalData),
          zone: readPoiZone(row.poi.additionalData),
          menu: readPoiMenu(row.poi.additionalData),
          slots: [],
        };
        byPoi.set(row.poiId, entry);
      }
      entry.slots.push({
        openTime: row.openTime.toISOString(),
        closeTime: row.closeTime.toISOString(),
        label: row.label,
      });
    }

    return Array.from(byPoi.values());
  } catch (error) {
    console.error(`Failed to load POI hours for park ${parkId}`, error);
    return [];
  }
}
