import { getPrisma } from "@/lib/prisma";
import { STANDBY_QUEUE, getQueueLabel } from "@/lib/queue-types";

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
