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
 * Les familles que propose le sélecteur de chaque onglet de la page d'un parc,
 * dans l'ordre de ses pastilles.
 *
 * ⚠️ **Deux listes, et elles ne se recouvrent pas** : un onglet ne propose que
 * les familles pour lesquelles il a une donnée. « En direct » vit des états et
 * des temps d'attente (`wait_times`) ; « Horaires du jour » des horaires — les
 * représentations (`show_times`) et les heures d'ouverture des autres POI
 * (`poi_hours`). Une famille présente dans les deux onglets y reste
 * sélectionnée d'un onglet à l'autre (voir `main-card.tsx`).
 *
 * ⚠️ **Hôtels et services : horaires seulement** (arbitré le 2026-10-06). Leur
 * état en direct n'aide personne — voir `POI_CARD_KINDS` pour les services —,
 * mais l'heure d'ouverture d'une réception ou d'un poste de secours, si une
 * source la publie un jour, a sa place dans la journée.
 *
 * ⚠️ **`show` est proposé en direct sans qu'aucune source n'y écrive** au
 * 2026-10-06 : le jour où l'une publiera l'état d'un spectacle (annulé, en
 * cours) dans `wait_times`, il aura sa pastille sans une ligne de plus.
 *
 * ⚠️ **Une famille ne s'affiche que si elle a du contenu**, mais le sélecteur,
 * lui, s'affiche TOUJOURS — même pour une seule famille, où sa pastille unique
 * sert de titre à la carte (arbitré le 2026-10-06).
 */
export const LIVE_FAMILIES = [
  "ride",
  "show",
  "restaurant",
  "shop",
] as const satisfies readonly PoiKind[];

export const SCHEDULE_FAMILIES = [
  "ride",
  "show",
  "restaurant",
  "shop",
  "hotel",
  "service",
] as const satisfies readonly PoiKind[];

export type LiveFamily = (typeof LIVE_FAMILIES)[number];
export type ScheduleFamily = (typeof SCHEDULE_FAMILIES)[number];
export type ParkFamily = LiveFamily | ScheduleFamily;

export function isLiveFamily(kind: PoiKind): kind is LiveFamily {
  return (LIVE_FAMILIES as readonly PoiKind[]).includes(kind);
}

export function isScheduleFamily(kind: PoiKind): kind is ScheduleFamily {
  return (SCHEDULE_FAMILIES as readonly PoiKind[]).includes(kind);
}

/**
 * Les familles de l'onglet « En direct » dont la liste est un ÉTAT, servi par
 * `poi-status-table.tsx` — par opposition aux attractions, qui ont leur propre
 * tableau.
 *
 * ⚠️ **`service` est ABSENT à dessein** (arbitré le 2026-08-28). Le worker les
 * rattache comme les autres — ça ferme des centaines d'alertes non matchées dans
 * l'admin et ça ne coûte rien de plus en base —, mais ils ne s'affichent pas
 * ici. Ce que ces sources y rangent, ce sont des toilettes, des casiers, des
 * zones fumeurs, des distributeurs d'eau, des guichets et des postes de secours,
 * par dizaines : chez Thorpe Park, 41 « services » contre 36 restaurants. Savoir
 * qu'une toilette est ouverte n'aide personne à organiser sa journée, et la
 * pastille noierait celles qui le font.
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
export const POI_CARD_KINDS = ["show", "restaurant", "shop", "hotel"] as const;

export type PoiCardKind = (typeof POI_CARD_KINDS)[number];

/** Mêmes pictogrammes que `POI_KIND_ICONS` de l'admin, pour un seul vocabulaire. */
export const POI_KIND_ICONS: Record<PoiKind, LucideIcon> = {
  ride: RollerCoaster,
  show: Drama,
  restaurant: UtensilsCrossed,
  shop: ShoppingBag,
  service: Wrench,
  hotel: BedDouble,
};

/**
 * Parcs dont une famille non-attraction publie une VRAIE file d'attente, et
 * pour lesquels la colonne « temps » a donc un sens.
 *
 * ⚠️ **Une liste, et non « la colonne s'ouvre dès qu'une valeur arrive ».** Ce
 * que la plupart de ces sources publient est un TÉMOIN OUVERT/FERMÉ, pas une
 * file : chez Compagnie des Alpes, un restaurant ouvert annonçait une
 * CONSTANTE — 300 s (5 min) à Bellewaerde, 60 s à Walibi Rhône-Alpes — et `-1`
 * fermé. Deux valeurs distinctes sur tout l'historique, mesuré sur 10 237
 * relevés. L'afficher comme un temps d'attente mettait « 5 min » en permanence
 * sur les quatorze restaurants du parc : une information fausse, indiscernable
 * d'une vraie pour qui la lit. Rien côté client ne distingue une constante
 * d'une vraie file — il faut l'historique.
 *
 * Remesuré le 2026-10-06 sur 21 jours : Bellewaerde, Walibi Holland,
 * Europa-Park, Rulantica et Cotaland n'écrivent plus que `-1`, ouvert comme
 * fermé (l'état passe, la constante non). Seul Nagashima Spa Land publie de
 * vraies valeurs, de 0 à 20 min.
 *
 * Le critère pour ajouter un parc : plus de deux valeurs distinctes de
 * `waitTime` dans l'historique de ce parc pour ce kind.
 *
 * ⚠️ **Les quatre parcs PRS entrent ENSEMBLE, sur la foi de la source.** Leur
 * attente vient du terminal de commande de chaque restaurant
 * (`parkfood/queue/{id}`), l'écran même qui affiche « 0-10 min väntetid » sur
 * le site. Mesuré le 2026-10-07, premier jour de collecte : Gröna Lund a déjà
 * 10, 20 et 30 min. Kolmården et Furuvik n'avaient encore qu'une valeur, avec
 * leurs terminaux presque tous éteints, et Skara Sommarland, fermé pour la
 * saison, aucune. Les quatre déclarent pourtant des terminaux dans leur CMS et
 * passent par la même route.
 */
const REAL_WAIT_TIMES: Record<string, readonly PoiKind[]> = {
  "nagashima-spa-land": ["restaurant"],
  "grona-lund": ["restaurant"],
  kolmarden: ["restaurant"],
  furuvik: ["restaurant"],
  "skara-sommarland": ["restaurant"],
};

/** Voir `REAL_WAIT_TIMES`. */
export function showsWaitTime(parkIdentifier: string, kind: PoiKind): boolean {
  if (kind === "ride") return true;
  return REAL_WAIT_TIMES[parkIdentifier]?.includes(kind) ?? false;
}

/**
 * Les familles de POI sur lesquelles une alerte PEUT exister, tous parcs
 * confondus : les attractions, et ce que `REAL_WAIT_TIMES` déclare. Pour un parc
 * donné, c'est `getTimedKinds` (`lib/timed-kinds.ts`) qui tranche.
 */
export const ALERT_KINDS: readonly PoiKind[] = [
  ...new Set<PoiKind>(["ride", ...Object.values(REAL_WAIT_TIMES).flat()]),
];
