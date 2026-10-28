import { lookupParks, lookupPois } from "@/lib/dispatch";
import { STANDBY_QUEUE, getQueueLabel } from "@/lib/queue-types";
import { parsePoiKind, type PoiKind } from "@/lib/poi-kinds";

/**
 * Nom affichable de la file d'une alerte, résolu auprès de l'API Dispatch :
 * celui que le parc lui donne (`queueTypeLabels`, « Disney Premier Access »),
 * sinon le libellé par défaut. `null` pour la file standby — l'alerte vise
 * alors l'attraction elle-même, rien à ajouter à son nom.
 *
 * ⚠️ La base utilisateurs n'a aucune clé vers les parcs : le nom est relu ici
 * à chaque lecture plutôt que recopié dans l'alerte, comme le nom du parc de
 * l'historique. Aucun appel quand toutes les alertes sont standby — le cas
 * courant.
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
  for (const p of await lookupParks(parkIds)) {
    labelsByPark.set(p.identifier, p.queueTypeLabels);
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
 * `ride` par repli — POI supprimé depuis, API injoignable : c'est la famille
 * de toutes les alertes d'avant le 2026-10-09.
 */
export async function poiKindResolver(
  rows: { rideId: number }[],
): Promise<(row: { rideId: number }) => PoiKind> {
  const ids = [...new Set(rows.map((r) => r.rideId))];
  const kindById = new Map<number, PoiKind>();
  try {
    for (const p of await lookupPois(ids)) {
      const kind = parsePoiKind(p.kind);
      if (kind) kindById.set(p.id, kind);
    }
  } catch {
    // API injoignable : tout reste « attraction ».
  }
  return (row) => kindById.get(row.rideId) ?? "ride";
}
