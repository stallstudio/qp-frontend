import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { DateTime } from "luxon";
import { OpeningHour } from "@/types/openingHour";
import { ParkStatus } from "@/types/park";
import { ParkList } from "@/types/api";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Convert time format type to Luxon format string
export function getLuxonFormat(is12Hour: boolean): string {
  return is12Hour ? "h:mm a" : "HH:mm";
}

// Get current time from a specified timezone
export function getLocalTime(timezone: string, is12Hour: boolean) {
  const format = getLuxonFormat(is12Hour);
  return DateTime.now().setZone(timezone).toFormat(format);
}

export function getParkStatus(openingHours: OpeningHour[]): ParkStatus {
  const now = DateTime.now().setZone("UTC");

  if (openingHours.length === 0) {
    return "unknown";
  }

  // Sold-out days: park is open but tickets are sold out (no hours exposed)
  const hasSoldOut = openingHours.some((hour) => hour.type === "sold_out");

  for (const hour of openingHours) {
    if (!hour.openTime || !hour.closeTime) {
      continue;
    }

    const openTime = DateTime.fromISO(hour.openTime, { zone: "UTC" });
    const closeTime = DateTime.fromISO(hour.closeTime, { zone: "UTC" });

    if (now >= openTime && now < closeTime) {
      return "open";
    }
  }

  if (hasSoldOut) {
    return "open";
  }

  return "closed";
}

export const getParkLink = (park: ParkList) => {
  return `/park/${park.identifier}`;
};

/**
 * Nom anglais d'un pays depuis son code ISO.
 *
 * ⚠️ **À N'APPELER QUE CÔTÉ SERVEUR.** `Intl.DisplayNames` s'appuie sur les
 * données ICU du runtime, et Node et les navigateurs n'embarquent pas la même
 * version de CLDR : pour `HK`, Node renvoie « Hong Kong SAR China » là où Chrome
 * renvoie « Hong Kong ». Appelée pendant le rendu d'un composant client (donc
 * exécutée une fois sur le serveur au SSR, une fois dans le navigateur à
 * l'hydratation), elle produit deux résultats différents et React signale une
 * erreur d'hydratation.
 *
 * Le nom est donc résolu UNE FOIS, dans `lib/parks-list.ts`, et transporté dans
 * `ParkList.countryName`.
 */
export function getCountryName(code: string): string {
  if (!code) return "";

  const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
  return regionNames.of(code.toUpperCase()) ?? code;
}

/**
 * Classe de drapeau twemoji (`twa-flag-…`) depuis le nom anglais du pays.
 *
 * `toLowerCase()` et non `toLocaleLowerCase()` : ce dernier dépend de la locale
 * par défaut du runtime (en turc, « I » devient « ı »), ce qui rendrait la classe
 * dépendante de l'environnement — le même piège que ci-dessus.
 */
export function getCountryFlagClass(countryName: string): string {
  return `twa twa-flag-${countryName.toLowerCase().replace(/\s+/g, "-")} twa-lg`;
}
