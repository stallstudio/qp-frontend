import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { DateTime } from "luxon";
import { OpeningHour } from "@/types/openingHour";
import { ParkStatus } from "@/types/park";
import { ParkList } from "@/types/api";
import { COUNTRY_FLAG_SLUGS } from "@/lib/country-flags.generated";

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
 * Nom d'un pays depuis son code ISO, dans la langue demandée (anglais par
 * défaut).
 *
 * ⚠️ **À N'APPELER QUE CÔTÉ SERVEUR.** `Intl.DisplayNames` s'appuie sur les
 * données ICU du runtime, et Node et les navigateurs n'embarquent pas la même
 * version de CLDR : pour `HK`, Node renvoie « Hong Kong SAR China » là où Chrome
 * renvoie « Hong Kong ». Appelée pendant le rendu d'un composant client (donc
 * exécutée une fois sur le serveur au SSR, une fois dans le navigateur à
 * l'hydratation), elle produit deux résultats différents et React signale une
 * erreur d'hydratation.
 *
 * Les deux noms sont donc résolus CÔTÉ SERVEUR dans `lib/parks-list.ts` et
 * transportés dans la charge utile : `ParkList.countryName` (anglais) et
 * `ParkList.countryLabel` (langue du visiteur, affiché).
 *
 * ⚠️ **Aucun des deux ne sert plus au drapeau** (2026-09-03) : il se déduit du
 * code ISO, cf. `getCountryFlagClass`.
 */
export function getCountryName(code: string, locale = "en"): string {
  if (!code) return "";

  const regionNames = new Intl.DisplayNames([locale], { type: "region" });
  return regionNames.of(code.toUpperCase()) ?? code;
}

/**
 * Classe de drapeau twemoji (`twa-flag-…`) depuis le **code ISO** du pays.
 *
 * ⚠️⚠️ **Le drapeau se déduisait du NOM ANGLAIS du pays, et ce nom n'est pas une
 * clé** (corrigé le 2026-09-03). La classe était fabriquée en minusculant
 * `Intl.DisplayNames` — « United States » → `twa-flag-united-states` — ce qui
 * marche jusqu'au premier pays que le CLDR n'écrit pas comme twemoji : la
 * Turquie sort `Türkiye` depuis le CLDR 42, la feuille de style ne connaît que
 * `twa-flag-turkey`, et le parc s'affichait sans drapeau.
 *
 * ⚠️ **Ce n'était pas un cas isolé, et c'est pour ça que le correctif n'est pas
 * un alias.** Mesuré sur les 280 régions que connaît le runtime : **37**
 * produisaient une classe inexistante, en cinq familles — les diacritiques
 * (Curaçao, Åland, Côte d'Ivoire, Réunion, São Tomé), l'esperluette (« Antigua &
 * Barbuda » quand la classe dit `antigua-barbuda`), les abréviations
 * (« St. Lucia », « U.S. Virgin Islands »), les parenthèses (« Myanmar
 * (Burma) ») et les renommages (Türkiye). Sur les 27 pays affichés aujourd'hui,
 * la Turquie était la seule touchée : les 36 autres attendaient leur premier
 * parc.
 *
 * La table `COUNTRY_FLAG_SLUGS` est **lue dans la feuille de style**, jamais
 * saisie : chaque règle `.twa-flag-…` pointe le SVG twemoji dont le nom de
 * fichier est la paire d'indicateurs régionaux du drapeau (`1f1f9-1f1f7` = 🇹🇷),
 * donc le code ISO. Voir `scripts/generate-country-flags.mjs`.
 *
 * Rend `null` pour un code sans drapeau — les 22 restants sont des codes
 * périmés ou fictifs (SU, YU, EZ, XA…), aucun n'est un pays de parc. L'appelant
 * n'affiche alors rien, plutôt qu'un carré vide de la taille d'un drapeau.
 */
export function getCountryFlagClass(countryCode: string): string | null {
  const slug = COUNTRY_FLAG_SLUGS[(countryCode ?? "").toUpperCase()];
  return slug ? `twa twa-flag-${slug} twa-lg` : null;
}
