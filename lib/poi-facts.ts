import { DateTime } from "luxon";
import { dayOpeningHours } from "@/lib/park-events";
import type { OpeningHour } from "@/types/openingHour";

/**
 * Ce que la source dit d'une maison hantée en plus de son nom et de son état :
 * son niveau de peur et son prix d'accès. Lus dans `additionalData`, écrit par
 * le worker — aujourd'hui les seuls parcs Compagnie des Alpes (Walibi,
 * Bellewaerde) en publient.
 *
 * ⚠️ Sondés et non castés, comme `readBanner` : `additionalData` est un `Json`
 * libre, sa forme n'est garantie par aucun type.
 */

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Niveau de peur, de 1 à 5 — le « scare-o-meter » des parcs CDA. Hors 1-5 : rien. */
export function readPoiFearLevel(value: unknown): number | null {
  const level = record(value)?.fearLevel;
  return typeof level === "number" &&
    Number.isInteger(level) &&
    level >= 1 &&
    level <= 5
    ? level
    : null;
}

export type PoiPrice = {
  /** Journée classique. `0` : gratuit, DIT par la source. */
  standard: number | null;
  /** Journée prolongée (nocturne). */
  extended: number | null;
  /** Code ISO 4217 — « EUR ». */
  currency: string;
  /**
   * Fermeture la plus tardive d'une journée classique de l'événement, et la plus
   * tôt d'une journée prolongée, en « HH:mm » (`25:00` = 1 h le lendemain).
   * Présentes seulement quand les deux prix diffèrent ET que les deux familles
   * de jours se séparent — voir `priceForToday`.
   */
  classicClosesBy: string | null;
  extendedClosesFrom: string | null;
};

const CLOCK = /^(\d{2}):([0-5]\d)$/;

/** « 22:00 » → 1 320 ; « 25:00 » → 1 500. `null` si illisible. */
function clockMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = CLOCK.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/**
 * Prix d'accès en plus du billet d'entrée (maison hantée, atelier).
 *
 * ⚠️ `0` est un vrai prix — « Accès : gratuit » dans la source —, à ne pas
 * confondre avec une absence, qui rend `null`.
 */
export function readPoiPrice(value: unknown): PoiPrice | null {
  const raw = record(record(value)?.price);
  if (!raw) return null;
  const { currency } = raw;
  if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) return null;
  const amount = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
  const standard = amount(raw.standard);
  const extended = amount(raw.extended);
  if (standard === null && extended === null) return null;
  const classic = clockMinutes(raw.classicClosesBy);
  const prolonged = clockMinutes(raw.extendedClosesFrom);
  const bounded = classic !== null && prolonged !== null && classic < prolonged;
  return {
    standard,
    extended,
    currency,
    classicClosesBy: bounded ? (raw.classicClosesBy as string) : null,
    extendedClosesFrom: bounded ? (raw.extendedClosesFrom as string) : null,
  };
}

/**
 * Heure de fermeture du parc AUJOURD'HUI, en minutes depuis le minuit de sa
 * journée d'exploitation (1 320 = 22:00, 1 500 = 1 h le lendemain). `null` si
 * le parc ne publie pas d'horaires pour aujourd'hui.
 *
 * Seules les lignes de la JOURNÉE comptent (`dayOpeningHours`) : c'est elle que
 * les parcs CDA prolongent, pas une session d'événement à part.
 */
export function parkCloseMinutes(
  openingHours: OpeningHour[],
  timezone: string,
): number | null {
  let latest: number | null = null;
  for (const hour of dayOpeningHours(openingHours)) {
    if (!hour.openTime || !hour.closeTime) continue;
    const open = DateTime.fromISO(hour.openTime, { zone: timezone });
    const close = DateTime.fromISO(hour.closeTime, { zone: timezone });
    if (!open.isValid || !close.isValid) continue;
    // ⚠️ L'heure de l'HORLOGE, pas une durée écoulée depuis minuit : le
    // 25/10/2026 (passage à l'heure d'hiver), la journée dure 25 h, et
    // « 22:00 » valait 23 h de durée — une journée prolongée lue 23:00.
    const days = Math.round(
      close.startOf("day").diff(open.startOf("day"), "days").days,
    );
    const minutes = days * 24 * 60 + close.hour * 60 + close.minute;
    if (latest === null || minutes > latest) latest = minutes;
  }
  return latest;
}

/**
 * Lequel des deux prix vaut aujourd'hui, DÉDUIT de l'heure de fermeture du
 * parc : fermeture au moins aussi tardive que la plus précoce des journées
 * prolongées → prix prolongé ; pas plus tardive que la plus tardive des
 * journées classiques → prix classique.
 *
 * `null` quand on ne peut pas trancher — pas de bornes, pas d'horaires du jour,
 * ou une fermeture entre les deux. L'appelant affiche alors les deux prix, ce
 * qui n'est jamais faux.
 *
 * Relevé le 2026-10-07 à Walibi Belgium : journées classiques 10:00 - 18:00,
 * prolongées 10:00 - 22:00 ; l'Aquarium coûte 6,50 € les unes, 7,50 € les
 * autres.
 */
export function priceForToday(
  price: PoiPrice,
  closeMinutes: number | null,
): "standard" | "extended" | null {
  if (closeMinutes === null) return null;
  const classic = clockMinutes(price.classicClosesBy);
  const prolonged = clockMinutes(price.extendedClosesFrom);
  if (classic === null || prolonged === null) return null;
  if (closeMinutes >= prolonged) return "extended";
  if (closeMinutes <= classic) return "standard";
  return null;
}
