import { DateTime } from "luxon";
import type { ParkEventDto } from "@/types/parkEvent";
import type { PoiHours } from "@/types/poiHours";
import type { RideHistoryResponse, TimedPoint } from "@/types/rideHistory";
import type { PoiKind } from "@/lib/poi-kinds";
import type { QueueTime, WaitTime, WaitTimeStatus } from "@/types/waitTime";

// ————————————————————————————————————————————————————————————————————————
// LES DONNÉES DES SCÈNES DE L'ANNONCE DE VERSION
//
// Les scènes rendent les VRAIS composants de la page d'un parc ; il leur faut
// donc de vraies données. Tout ce qui est NOMMÉ ici — POI, identifiant, quartier,
// horaires, niveau de peur, image — a été relevé tel quel dans
// `/api/park/{parc}` le 2026-10-10 : Disneyland Paris pour la page d'un parc,
// Walibi Holland pour Halloween Fright Nights.
//
// ⚠️ **Les temps d'attente et les états, eux, sont des valeurs de journée
// choisies** : relevés la nuit, tout était fermé. Ce sont des valeurs que ces
// attractions affichent un jour ordinaire, pas une capture.
//
// ⚠️ Les horaires sont rebâtis SUR LA DATE DU JOUR (`today`) : la grille des
// horaires et le graphique placent leur repère « maintenant » d'après l'heure
// réelle, et une journée d'une autre date ne serait jamais « en cours ».
// ————————————————————————————————————————————————————————————————————————

export const DLP = {
  identifier: "disneyland-paris",
  name: "Disneyland Paris",
  timezone: "Europe/Paris",
  queueTypeLabels: { virtualqueue: "Disney Premier Access" },
} as const;

export const WALIBI_HOLLAND = {
  identifier: "walibi-holland",
  name: "Walibi Holland",
  timezone: "Europe/Amsterdam",
} as const;

function queue(
  status: WaitTimeStatus,
  waitTime: number,
  type = "standby",
  timeSlot: QueueTime["timeSlot"] = null,
): QueueTime {
  return { type, waitTime, status, timeSlot };
}

function poi(
  rideId: number,
  rideName: string,
  kind: PoiKind,
  zone: string | null,
  queues: QueueTime[],
  extra: Partial<WaitTime> = {},
): WaitTime {
  return {
    rideId,
    rideName,
    queues,
    eventId: null,
    banner: null,
    kind,
    zone,
    menu: null,
    fearLevel: null,
    price: null,
    ...extra,
  };
}

/* ————— Disneyland Paris, en direct ————— */

export const BIG_THUNDER_ID = 425;
export const HYPERSPACE_ID = 455;
export const CASEYS_CORNER_ID = 2016295;

export const DLP_RIDES: WaitTime[] = [
  poi(BIG_THUNDER_ID, "Big Thunder Mountain", "ride", "Frontierland", [
    queue("open", 45),
    queue("open", 0, "virtualqueue", { start: "14:30", end: "15:30" }),
  ]),
  poi(448, "Peter Pan's Flight", "ride", "Fantasyland", [
    queue("open", 60),
    queue("open", 0, "virtualqueue", { start: "15:00", end: "16:00" }),
  ]),
  poi(449, "Phantom Manor", "ride", "Frontierland", [
    queue("open", 20),
    queue("open", 0, "virtualqueue", { start: "13:30", end: "14:30" }),
  ]),
  poi(451, "Pirates of the Caribbean", "ride", "Adventureland", [
    queue("open", 15),
    queue("open", 0, "virtualqueue", { start: "13:30", end: "14:30" }),
  ]),
];

/** La ligne dépliée de la scène des files : standby, Single Rider, DPA. */
export const HYPERSPACE: WaitTime = poi(
  HYPERSPACE_ID,
  "Star Wars Hyperspace Mountain",
  "ride",
  "Discoveryland",
  [
    queue("open", 50),
    queue("open", 15, "singlerider"),
    queue("open", 0, "virtualqueue", { start: "14:30", end: "15:30" }),
  ],
);

export const DLP_RESTAURANTS: WaitTime[] = [
  poi(CASEYS_CORNER_ID, "Casey’s Corner", "restaurant", "Main Street U.S.A.", [
    queue("open", -1),
  ]),
  poi(2016287, "Agrabah Café Restaurant", "restaurant", "Adventureland", [
    queue("open", -1),
  ]),
  poi(2016288, "Au Chalet de la Marionnette", "restaurant", "Fantasyland", [
    queue("open", -1),
  ]),
  poi(2016296, "Colonel Hathi’s Outpost Restaurant", "restaurant", "Adventureland", [
    queue("closed", -1),
  ]),
];

export const DLP_SHOPS: WaitTime[] = [
  poi(2016345, "Emporium", "shop", "Main Street U.S.A.", [queue("open", -1)]),
  poi(2016343, "Disney & Co.", "shop", "Main Street U.S.A.", [queue("open", -1)]),
  poi(2016341, "Constellations", "shop", "Discoveryland", [queue("open", -1)]),
  poi(2016339, "Big Thunder Photographer", "shop", "Frontierland", [
    queue("closed", -1),
  ]),
];

/** Les favoris de la démo : Casey’s Corner, pour montrer l'étoile épinglée. */
export const DLP_FAVORITES = {
  restaurants: [`${DLP.identifier}:${CASEYS_CORNER_ID}`],
  rides: [`${DLP.identifier}:${BIG_THUNDER_ID}`],
};

/* ————— Disneyland Paris, horaires du jour ————— */

/** Le jour du parc, à la date d'aujourd'hui. */
export function parkToday(timezone: string): DateTime {
  return DateTime.now().setZone(timezone).startOf("day");
}

function hoursOf(
  poiId: number,
  name: string,
  kind: PoiKind,
  zone: string,
  slots: [number, number][],
  timezone: string,
): PoiHours {
  const day = parkToday(timezone);
  const at = (hour: number) =>
    day.plus({ minutes: Math.round(hour * 60) }).toUTC().toISO()!;
  return {
    poiId,
    name,
    kind,
    eventId: null,
    banner: null,
    zone,
    menu: null,
    fearLevel: null,
    price: null,
    slots: slots.map(([open, close]) => ({
      openTime: at(open),
      closeTime: at(close),
      label: null,
    })),
  };
}

/**
 * La première colonne de la grille pour ces horaires : une heure avant la
 * première ouverture (8 h dans les trois familles), comme le calcule
 * `calculateParkHours`.
 */
export const DLP_GRID_START_HOUR = 7;

/** Horaires relevés le 2026-10-10, en heure de Paris. */
export function dlpHours(): Record<"ride" | "restaurant" | "shop", PoiHours[]> {
  const tz = DLP.timezone;
  return {
    ride: [
      hoursOf(BIG_THUNDER_ID, "Big Thunder Mountain", "ride", "Frontierland", [[8, 22]], tz),
      hoursOf(448, "Peter Pan's Flight", "ride", "Fantasyland", [[8, 22]], tz),
      hoursOf(434, "Dumbo the Flying Elephant", "ride", "Fantasyland", [[8, 21]], tz),
      hoursOf(445, "Main Street Vehicles", "ride", "Main Street U.S.A.", [[8, 14.75]], tz),
    ],
    restaurant: [
      hoursOf(CASEYS_CORNER_ID, "Casey’s Corner", "restaurant", "Main Street U.S.A.", [[11, 22.5]], tz),
      hoursOf(2016307, "Market House Deli", "restaurant", "Main Street U.S.A.", [[8, 22.5]], tz),
      hoursOf(2016290, "Cable Car Bake Shop", "restaurant", "Main Street U.S.A.", [[9, 22]], tz),
      hoursOf(2016291, "Café Hyperion", "restaurant", "Discoveryland", [[11, 21.5]], tz),
      hoursOf(2016320, "Walt’s – an American restaurant", "restaurant", "Main Street U.S.A.", [[11.5, 20.5]], tz),
    ],
    shop: [
      hoursOf(2016345, "Emporium", "shop", "Main Street U.S.A.", [[8, 22]], tz),
      hoursOf(2016341, "Constellations", "shop", "Discoveryland", [[8, 22]], tz),
      hoursOf(2016362, "Plaza West Boutique", "shop", "Main Street U.S.A.", [[8.5, 22]], tz),
      hoursOf(2016353, "Le Coffre du Capitaine", "shop", "Adventureland", [[9, 22]], tz),
    ],
  };
}

/* ————— Walibi Holland, Halloween Fright Nights ————— */

export const SLAUGHTERHOUSE_ID = 2015056;

/** Les maisons, telles que l'API les range : sans temps d'attente publié. */
export const FRIGHT_NIGHTS_HOUSES: WaitTime[] = [
  ["Below", 2015058, 4, "Experience"],
  ["Camp of Curiosities", 2015066, 4, "Walkthrough"],
  ["Jefferson Manor", 2015062, 4, "Haunted House"],
  ["Psychoshock", 2015064, 4, "Haunted House"],
  ["Slaughterhouse", SLAUGHTERHOUSE_ID, 5, "Experience"],
  ["The Clinic", 2015057, 5, "Experience"],
  ["The Villa", 2015063, 4, "Haunted House"],
].map(([name, id, fear, zone]) =>
  poi(id as number, name as string, "ride", zone as string, [], {
    eventId: 21,
    fearLevel: fear as number,
  }),
);

export const FRIGHT_NIGHTS_FAVORITES = {
  rides: [`${WALIBI_HOLLAND.identifier}:${SLAUGHTERHOUSE_ID}`],
};

/** L'événement tel que le sert l'API, ses sessions rebâties sur aujourd'hui. */
export function frightNights(): { event: ParkEventDto; closesAt: Date } {
  const day = parkToday(WALIBI_HOLLAND.timezone);
  const close = day.set({ hour: 23 });
  return {
    event: {
      id: 21,
      name: "Halloween Fright Nights",
      accent: "halloween",
      separateTicket: true,
      sessions: [
        {
          startsAt: day.set({ hour: 10 }).toUTC().toISO()!,
          endsAt: close.toUTC().toISO()!,
        },
      ],
      startDate: day.toISODate()!,
      endDate: day.plus({ weeks: 3 }).toISODate()!,
      visibility: "auto",
      inPeriod: true,
      skipsToday: false,
    },
    closesAt: close.toJSDate(),
  };
}

/* ————— Le graphique d'une attraction ————— */

/**
 * Une journée type d'une attraction qui publie des FOURCHETTES (« 10–20 min »),
 * comme Liseberg ou Gröna Lund : chaque valeur est la borne haute d'une
 * fourchette, et `valueRanges` les relie.
 *
 * ⚠️ Date FIXE, comme la démo de la page À propos : la courbe doit être la même
 * à chaque ouverture, et « maintenant » tomber en pleine journée.
 */
export function rangedRideHistory(): RideHistoryResponse {
  const zone = "Europe/Stockholm";
  const day = DateTime.fromISO("2026-06-13T00:00", { zone });
  const at = (h: number, m = 0) => day.set({ hour: h, minute: m }).toISO()!;
  const points = (rows: [number, number, number][]): TimedPoint[] =>
    rows.map(([h, m, w]) => ({ t: at(h, m), waitTime: w, status: "open" }));

  return {
    timezone: zone,
    window: { open: at(10), close: at(20) },
    now: at(14, 30),
    today: points([
      [10, 0, 10], [10, 30, 10], [11, 0, 20], [11, 30, 20], [12, 0, 30],
      [12, 30, 30], [13, 0, 40], [13, 30, 30], [14, 0, 20], [14, 30, 20],
    ]),
    // Ce qui avait été annoncé une heure avant : proche, pas identique.
    forecastTrail: points([
      [10, 0, 10], [10, 30, 20], [11, 0, 20], [11, 30, 30], [12, 0, 30],
      [12, 30, 30], [13, 0, 30], [13, 30, 30], [14, 0, 30], [14, 30, 20],
    ]),
    forecast: points([
      [14, 30, 20], [15, 0, 30], [15, 30, 40], [16, 0, 40], [16, 30, 40],
      [17, 0, 30], [17, 30, 30], [18, 0, 20], [18, 30, 20], [19, 0, 10],
      [19, 30, 10], [20, 0, 10],
    ]),
    meta: {
      scale: 1,
      confidence: 0.8,
      confidenceLevel: "high",
      preOpening: false,
      method: "profile",
      historyDays: 40,
      chronicallyUnavailable: false,
      marginMinutes: 6,
      marginSamples: 40,
      waitCap: null,
      valueRanges: [
        { value: 10, min: 0, max: 10 },
        { value: 20, min: 10, max: 20 },
        { value: 30, min: 20, max: 30 },
        { value: 40, min: 30, max: 40 },
      ],
    },
  };
}
