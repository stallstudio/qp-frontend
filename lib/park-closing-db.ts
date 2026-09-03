import { getPrisma } from "@/lib/prisma";
import {
  parkOpenWindowFrom,
  reopenPeriodsFor,
  type OpeningPeriod,
  type ParkOpenWindow,
  type ReopenScope,
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

/**
 * Périodes d'ouverture courantes des parcs demandés, TOUS TYPES CONFONDUS. Une
 * seule requête, quel que soit le nombre de parcs.
 *
 * ⚠️ **Le tri se fait à la LECTURE, plus dans le `where`.** Cette requête
 * écartait les sessions d'événement (`type: { not: "event" }`) parce qu'elle ne
 * servait qu'au réarmement, où une nocturne rendrait « ouvertes » des
 * attractions de jour endormies. Mais la même donnée sert aussi à décider si
 * l'on peut CRÉER une alerte, et là les sessions comptent — sinon aucune alerte
 * n'est possible pendant Halloween Horror Nights, mazes compris. Les périodes
 * sortent donc entières, avec leur `type` et leur `eventId`, et c'est
 * `reopenPeriodsFor` qui choisit celles qui s'appliquent.
 *
 * ⚠️ `private_event` et `sold_out` ne sont volontairement PAS écartés ici : ils
 * le sont côté frontend, pas côté serveur, et l'écart est antérieur à cette
 * fonctionnalité. Le corriger changerait le comportement des alertes sur des
 * parcs sans rapport — à traiter à part.
 */
export async function loadParkHourPeriods(
  parkIds: number[],
  now: Date,
): Promise<Map<number, OpeningPeriod[]>> {
  const result = new Map<number, OpeningPeriod[]>();
  if (parkIds.length === 0) return result;

  const rows = await getPrisma().openingHours.findMany({
    where: {
      parkId: { in: parkIds },
      closeTime: { gte: new Date(now.getTime() - LOOKBACK_MS) },
    },
    select: {
      parkId: true,
      openTime: true,
      closeTime: true,
      type: true,
      eventId: true,
    },
  });

  for (const row of rows) {
    const list = result.get(row.parkId) ?? [];
    list.push({
      openTime: row.openTime,
      closeTime: row.closeTime,
      type: row.type,
      eventId: row.eventId,
    });
    result.set(row.parkId, list);
  }

  return result;
}

/**
 * État d'ouverture applicable à UNE attraction : les périodes de son parc,
 * filtrées par son rattachement événementiel et par l'usage (voir
 * `reopenPeriodsFor`).
 *
 * ⚠️ Un parc sans aucune ligne reste « unknown », que `parkOpenWindowFrom`
 * déduit d'une liste vide : on ne conclut RIEN d'une absence d'horaires, sous
 * peine de supprimer la fonctionnalité chez tous les parcs qui n'en publient
 * pas.
 */
export function rideOpenWindow(
  periods: OpeningPeriod[] | undefined,
  now: Date,
  opts: { eventId?: number | null; scope: ReopenScope },
): ParkOpenWindow {
  return parkOpenWindowFrom(reopenPeriodsFor(periods ?? [], opts), now);
}
