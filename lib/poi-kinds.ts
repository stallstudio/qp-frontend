/**
 * Les types de POI admis en base.
 *
 * ⚠️ **`Poi.kind` est un `VarChar(20)` et non un enum**, volontairement : ajouter
 * un type ne doit pas coûter un `ALTER` sur la table ni une migration dans les
 * trois dépôts qui dupliquent le schéma. Le prix de ce choix, c'est que la liste
 * doit être tenue à jour À LA MAIN dans chacun — `src/types/poi.ts` côté worker,
 * `lib/poi-kinds.ts` côté admin, ici côté frontend. Rien ne signale l'oubli :
 * `hotel` a manqué des mois dans l'admin, dont le filtre ne le proposait pas et
 * dont la colonne « Type » affichait « Attraction » par repli.
 */
export const POI_KINDS = [
  "ride",
  "show",
  "restaurant",
  "shop",
  "service",
  "hotel",
] as const;

export type PoiKind = (typeof POI_KINDS)[number];

export function parsePoiKind(value: string | null | undefined): PoiKind | null {
  return POI_KINDS.includes(value as PoiKind) ? (value as PoiKind) : null;
}

// ⚠️ **Les cartes par famille de POI sont reportées en V4** (arbitré le
// 2026-09-03, retirées de la V3 juste avant sa mise en production).
//
// Ce qui vivait ici et qui est parti avec elles : `POI_CARD_KINDS` (les familles
// qui recevaient leur propre carte dans l'onglet « En direct » — restaurant,
// shop, hotel, `service` volontairement exclu), `POI_KIND_ICONS` (les
// pictogrammes de ces cartes) et `REAL_WAIT_TIMES` (les parcs dont une famille
// non-attraction publie une VRAIE file, aucun à ce jour). Avec eux :
// `components/parks/poi-status-table.tsx`,
// `components/parks/poi-detail/poi-detail-dialog.tsx`, `readPoiMenu`
// (`lib/poi-banner.ts`) et le champ `menu` de `WaitTime`, que seul ce popup
// lisait — `readBanner` et `readPoiZone`, eux, servent aux attractions et aux
// spectacles et restent en place.
//
// ⚠️ **Ce qui RESTE ci-dessus n'est pas de la feature, ne pas l'emporter au
// nettoyage** : `parsePoiKind` alimente le champ `kind` de `WaitTime`, sur
// lequel `main-card` filtre `kind === "ride"`. Le worker continue de rattacher
// restaurants, boutiques et services, et le serveur continue de les servir : ce
// filtre est le seul rempart qui les empêche de tomber au milieu des coasters de
// la carte « Attractions », avec un « 5 min » qui n'est qu'une sentinelle
// d'ouverture. Le retirer serait la régression exacte que la partition évitait.
//
// Pour rouvrir la feature : `git log --diff-filter=D -- components/parks/poi-status-table.tsx`
// mène au commit de retrait, dont le revert la ramène en entier. La branche
// `dev` en garde par ailleurs la version vivante.
