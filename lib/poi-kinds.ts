import {
  BedDouble,
  Drama,
  RollerCoaster,
  ShoppingBag,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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

/**
 * Les familles qui reçoivent leur PROPRE carte dans l'onglet « En direct »,
 * dans leur ordre d'affichage sous la carte des attractions.
 *
 * `ride` n'y est pas : c'est la carte principale, elle a son propre tableau.
 * `show` non plus : ses horaires vivent dans l'autre onglet.
 *
 * ⚠️ **`service` est ABSENT à dessein** (arbitré le 2026-08-28). Le worker les
 * rattache comme les autres — ça ferme des centaines d'alertes non matchées dans
 * l'admin et ça ne coûte rien de plus en base —, mais ils ne s'affichent pas
 * ici. Ce que ces sources y rangent, ce sont des toilettes, des casiers, des
 * zones fumeurs, des distributeurs d'eau, des guichets et des postes de secours,
 * par dizaines : chez Thorpe Park, 41 « services » contre 36 restaurants. Savoir
 * qu'une toilette est ouverte n'aide personne à organiser sa journée, et la
 * carte noierait celles qui le font.
 *
 * ⚠️ **Une carte ne se rend que si elle a du contenu.** L'écrasante majorité des
 * parcs ne publie l'état d'aucun de ces POI ; leur page est alors strictement
 * celle d'avant.
 *
 * ⚠️ **Une famille présente en base n'est pas une famille VIVANTE, et le tri se
 * fait ailleurs.** Mesuré le 2026-08-28 : chez Merlin, Knoebels, Gardaland et
 * les LEGOLAND, les relevés de restaurants, boutiques ET services sont tous
 * `closed` avec un `lastSeenAt` figé au 27 avril 2026 — la source a cessé de les
 * émettre ce jour-là, alors que ces parcs sont collectés à la minute. C'est
 * `STALE_WAIT_TIME_MS` (`lib/wait-times.ts`, 3 jours) qui les écarte, pas cette
 * liste : sur les 1 092 POI concernés en base, quinze seulement sont vivants
 * (douze restaurants à Bellewaerde, trois à Walibi Holland). Ne pas chercher à
 * dupliquer ce filtre ici.
 */
export const POI_CARD_KINDS = ["restaurant", "shop", "hotel"] as const;

export type PoiCardKind = (typeof POI_CARD_KINDS)[number];

/** Mêmes pictogrammes que `POI_KIND_ICONS` de l'admin, pour un seul vocabulaire. */
export const POI_KIND_ICONS: Record<PoiKind, LucideIcon> = {
  ride: RollerCoaster,
  show: Drama, // les spectacles ont leur propre carte, dans l'autre onglet
  restaurant: UtensilsCrossed,
  shop: ShoppingBag,
  service: Wrench,
  hotel: BedDouble,
};

/**
 * Parcs dont une famille non-attraction publie une VRAIE file d'attente, et
 * pour lesquels la colonne « temps » a donc un sens.
 *
 * ⚠️ **Vide, et ce n'est pas un oubli.** Ce que ces sources publient est un
 * TÉMOIN OUVERT/FERMÉ, pas une file : chez Compagnie des Alpes, un restaurant
 * ouvert annonce une CONSTANTE — 300 s (5 min) à Bellewaerde, 60 s à Walibi
 * Rhône-Alpes — et `-1` fermé. Deux valeurs distinctes sur tout l'historique,
 * mesuré sur 10 237 relevés. La valeur est stockée telle quelle (c'est ce que la
 * source dit), mais l'afficher comme un temps d'attente afficherait « 5 min »
 * en permanence sur les quatorze restaurants du parc : une information fausse,
 * indiscernable d'une vraie pour qui la lit.
 *
 * Le jour où une source publie une vraie file de restaurant, l'ouvrir tient en
 * une ligne ici. Le critère pour l'ajouter : plus de deux valeurs distinctes de
 * `waitTime` dans l'historique de ce parc pour ce kind.
 */
const REAL_WAIT_TIMES: Record<string, readonly PoiKind[]> = {};

/** Voir `REAL_WAIT_TIMES`. */
export function showsWaitTime(parkIdentifier: string, kind: PoiKind): boolean {
  if (kind === "ride") return true;
  return REAL_WAIT_TIMES[parkIdentifier]?.includes(kind) ?? false;
}
