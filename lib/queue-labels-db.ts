import { getPrisma } from "@/lib/prisma";
import { STANDBY_QUEUE, getQueueLabel } from "@/lib/queue-types";
import { parsePoiKind, type PoiKind } from "@/lib/poi-kinds";

/**
 * Nom affichable de la file d'une alerte, résolu depuis la base principale :
 * celui que le parc lui donne (`parks.queueTypeLabels`, « Disney Premier
 * Access »), sinon le libellé par défaut. `null` pour la file standby —
 * l'alerte vise alors l'attraction elle-même, rien à ajouter à son nom.
 *
 * ⚠️ La base utilisateurs n'a aucune clé vers la principale : le nom est relu
 * ici à chaque lecture plutôt que recopié dans l'alerte, comme le nom du parc
 * de l'historique. Aucune requête quand toutes les alertes sont standby — le
 * cas courant.
 */
export async function queueLabelResolver(
  rows: { parkIdentifier: string; queueType: string }[],
): Promise<(row: { parkIdentifier: string; queueType: string }) => string | null> {
  const parkIds = [
    ...new Set(
      rows
        .filter((r) => r.queueType !== STANDBY_QUEUE)
        .map((r) => r.parkIdentifier),
    ),
  ];
  const labelsByPark = new Map<string, Record<string, string> | null>();
  if (parkIds.length > 0) {
    const parks = await getPrisma().park.findMany({
      where: { identifier: { in: parkIds } },
      select: { identifier: true, queueTypeLabels: true },
    });
    for (const p of parks) {
      labelsByPark.set(
        p.identifier,
        p.queueTypeLabels as Record<string, string> | null,
      );
    }
  }
  return (row) =>
    row.queueType === STANDBY_QUEUE
      ? null
      : getQueueLabel(row.queueType, labelsByPark.get(row.parkIdentifier));
}

/**
 * Famille du POI d'une alerte (attraction, restaurant…), pour que le profil
 * l'affiche avec son pictogramme et la range sous la bonne pastille. Même
 * principe que le nom de la file : relue ici, jamais recopiée dans l'alerte.
 *
 * `ride` par repli — POI supprimé depuis, base injoignable : c'est la famille
 * de toutes les alertes d'avant le 2026-10-09.
 */
export async function poiKindResolver(
  rows: { rideId: number }[],
): Promise<(row: { rideId: number }) => PoiKind> {
  const ids = [...new Set(rows.map((r) => r.rideId))];
  const kindById = new Map<number, PoiKind>();
  if (ids.length > 0) {
    try {
      const pois = await getPrisma().poi.findMany({
        where: { id: { in: ids } },
        select: { id: true, kind: true },
      });
      for (const p of pois) {
        const kind = parsePoiKind(p.kind);
        if (kind) kindById.set(p.id, kind);
      }
    } catch {
      // Base principale injoignable : tout reste « attraction ».
    }
  }
  return (row) => kindById.get(row.rideId) ?? "ride";
}
