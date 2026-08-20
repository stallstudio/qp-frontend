import { getPrisma } from "@/lib/prisma";
import {
  parkOpenWindowFrom,
  type OpeningPeriod,
  type ParkOpenWindow,
} from "@/lib/park-closing";

// Chargement des horaires depuis la base principale, pour la règle de proximité
// de fermeture (voir `lib/park-closing.ts`, qui porte la règle elle-même).
//
// Séparé de ce module-là parce qu'il importe Prisma : `park-closing.ts` doit
// rester importable depuis un composant client, qui a déjà les horaires du parc
// sous la main et n'a donc aucune requête à faire.

// Bornage de la requête (et donc du scan) : une période plus vieille que ça ne
// peut plus être en cours.
const LOOKBACK_MS = 24 * 60 * 60_000;

// État d'ouverture courant des parcs demandés. Une seule requête, quel que soit
// le nombre de parcs.
export async function loadParkOpenWindows(
  parkIds: number[],
  now: Date,
): Promise<Map<number, ParkOpenWindow>> {
  const result = new Map<number, ParkOpenWindow>();
  if (parkIds.length === 0) return result;

  const rows = await getPrisma().openingHours.findMany({
    where: {
      parkId: { in: parkIds },
      closeTime: { gte: new Date(now.getTime() - LOOKBACK_MS) },
      // ⚠️ **Les sessions d'événement sont exclues, et c'est indispensable.**
      // Cette requête sert à décider si une alerte de RÉOUVERTURE a encore un
      // sens. Une nocturne qui court jusqu'à 1 h du matin rendrait le parc
      // « ouvert » toute la soirée et rouvrirait ce droit sur TOUTES ses
      // attractions — y compris celles de jour, arrêtées pour la nuit. Chaque
      // soir d'octobre partirait alors une salve de « c'est de nouveau à
      // l'arrêt » qui ne décrit aucun incident.
      //
      // ⚠️ `private_event` et `sold_out` ne sont volontairement PAS exclus ici :
      // ils le sont côté frontend, pas côté serveur, et l'écart est
      // antérieur à cette fonctionnalité. Le corriger changerait le
      // comportement des alertes sur des parcs sans rapport — à traiter à part.
      type: { not: "event" },
    },
    select: { parkId: true, openTime: true, closeTime: true },
  });

  const byPark = new Map<number, OpeningPeriod[]>();
  for (const row of rows) {
    const list = byPark.get(row.parkId) ?? [];
    list.push({ openTime: row.openTime, closeTime: row.closeTime });
    byPark.set(row.parkId, list);
  }

  // Un parc sans aucune ligne reste « unknown » : `parkOpenWindowFrom` le déduit
  // d'une liste vide, on n'a donc pas de cas particulier à traiter ici.
  for (const id of parkIds) {
    result.set(id, parkOpenWindowFrom(byPark.get(id) ?? [], now));
  }

  return result;
}
