import type { TimeFormatType } from "@/components/providers/time-format-provider";
import type { TemperatureUnit } from "@/components/providers/temperature-unit-provider";

/**
 * ————————————————————————————————————————————————————————————————
 * LES DÉFAUTS RÉGIONAUX, CALCULÉS PAR LE SERVEUR
 * ————————————————————————————————————————————————————————————————
 *
 * Format horaire et unité de température sont des préférences que le visiteur
 * peut régler — mais tant qu'il ne l'a pas fait, il faut bien en choisir une.
 *
 * ⚠️ **Le calcul a lieu côté SERVEUR, et c'est ce qui supprime l'erreur
 * d'hydratation.** Les deux providers lisaient `localStorage` dans
 * l'initialiseur de leur `useState` : le serveur rendait « 24h / Celsius »
 * pendant que le navigateur rendait autre chose DÈS SON PREMIER RENDU, et tout
 * horaire — toute température — de la page divergeait entre les deux. React n'y
 * remédie pas silencieusement : il jette le HTML servi et re-rend l'arbre.
 *
 * En passant le défaut en prop, le premier rendu est identique des deux côtés,
 * et il est déjà JUSTE pour la quasi-totalité des visiteurs : plus de bascule
 * visible non plus.
 *
 * ⚠️ **Module PUR** (aucun accès aux `headers()`), pour rester testable et
 * importable des deux côtés. La lecture de la requête vit dans le layout.
 */

/**
 * Les pays qui mesurent en Fahrenheit. Liste FERMÉE et courte — c'est le reste
 * du monde qui est en Celsius, pas l'inverse.
 *
 * Les territoires américains y figurent (Guam, Porto Rico, Îles Vierges, Samoa,
 * Mariannes) : leur code pays est distinct de `US`, et ils suivent l'usage
 * américain.
 */
const FAHRENHEIT_COUNTRIES = new Set([
  "US", "BS", "BZ", "KY", "LR", "PW", "FM", "MH",
  "GU", "PR", "VI", "AS", "MP",
]);

/**
 * Étiquettes d'en-tête de géolocalisation, par ordre de préférence.
 *
 * ⚠️ Aucune n'est garantie : elles dépendent de ce qui se trouve devant
 * l'application. Cloudflare pose `cf-ipcountry`, Vercel
 * `x-vercel-ip-country` ; un reverse proxy maison peut poser autre chose. En
 * l'absence des trois, on retombe sur `Accept-Language`, qui est toujours là.
 */
export const COUNTRY_HEADERS = [
  "cf-ipcountry",
  "x-vercel-ip-country",
  "x-country-code",
] as const;

export type RegionalDefaults = {
  timeFormat: TimeFormatType;
  temperatureUnit: TemperatureUnit;
};

/** Ce qu'on rend quand on ne sait rien : le choix produit historique. */
export const NEUTRAL_DEFAULTS: RegionalDefaults = {
  timeFormat: "24h",
  temperatureUnit: "celsius",
};

/**
 * Une étiquette BCP-47 plausible, ou `null`.
 *
 * ⚠️ `Intl.DateTimeFormat` lève un `RangeError` sur une étiquette malformée, et
 * `Accept-Language` vient du client : n'importe qui peut y écrire n'importe
 * quoi. On filtre sur la forme AVANT, et on garde un `try` par-dessus.
 */
function asLanguageTag(value: string): string | null {
  const tag = value.trim();
  return /^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/.test(tag) ? tag : null;
}

/**
 * Les étiquettes d'un `Accept-Language`, de la plus souhaitée à la moins.
 *
 * ⚠️ **Triées par `q`, jamais par ordre d'apparition.** `fr;q=0.5, en-GB` place
 * l'anglais britannique en tête malgré sa position — c'est tout l'objet du
 * paramètre. Le défaut de `q` est 1.
 */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part) => {
      const [raw, ...params] = part.split(";");
      const tag = asLanguageTag(raw);
      if (!tag || tag === "*") return null;
      const q = params
        .map((p) => /^\s*q=([0-9.]+)\s*$/i.exec(p))
        .find(Boolean);
      const weight = q ? Number.parseFloat(q[1]) : 1;
      return { tag, weight: Number.isFinite(weight) ? weight : 0 };
    })
    .filter((entry): entry is { tag: string; weight: number } => entry !== null)
    .sort((a, b) => b.weight - a.weight)
    .map((entry) => entry.tag);
}

/** Le code pays d'une étiquette (`en-GB` → `GB`), s'il y en a un. */
function regionOf(tag: string): string | null {
  const region = tag.split("-").find((part) => /^[A-Za-z]{2}$/.test(part) && part === part.toUpperCase());
  return region ?? null;
}

/**
 * Le format horaire d'une étiquette, tel que le système du pays l'utilise.
 *
 * ⚠️ **La RÉGION change le verdict, et pas qu'à la marge** (mesuré) :
 * `en-US` → 12 h mais `en-GB` → 24 h ; `es` → 24 h mais `es-MX` → 12 h ;
 * `pt` → 24 h et `pt-BR` → 24 h ; `zh` → 24 h mais `zh-TW` → 12 h. Se contenter
 * de la locale de l'URL — qui ne porte QUE la langue — mettrait donc tous les
 * anglophones en 12 h, Britanniques compris.
 */
function timeFormatOf(tag: string): TimeFormatType | null {
  try {
    const resolved = new Intl.DateTimeFormat(tag, {
      hour: "numeric",
    }).resolvedOptions();
    return resolved.hour12 ? "12h" : "24h";
  } catch {
    return null;
  }
}

/**
 * Les deux défauts, pour cette requête.
 *
 * Ordre de préséance, du plus fiable au moins :
 *
 * 1. **Le pays de l'en-tête de géolocalisation** — c'est là où le visiteur se
 *    trouve vraiment, et la seule source qui tranche l'unité de température.
 * 2. **La région d'`Accept-Language`** (`en-GB`) — sa préférence déclarée.
 * 3. **La locale de l'URL** — la langue seule, donc un verdict grossier mais
 *    jamais absurde.
 *
 * ⚠️ **Le pays ne commande PAS le format horaire à lui seul** : il est combiné
 * à la langue (`fr` + `US` → `fr-US`), sans quoi un francophone aux États-Unis
 * passerait en 12 h. Pour la température, en revanche, c'est bien le pays qui
 * décide — un Américain veut des Fahrenheit quelle que soit sa langue.
 */
export function regionalDefaults(input: {
  locale: string;
  acceptLanguage?: string | null;
  countryCode?: string | null;
}): RegionalDefaults {
  const country = normalizeCountry(input.countryCode);
  const preferred = parseAcceptLanguage(input.acceptLanguage);

  // ————— Format horaire —————
  const candidates = [
    country ? `${input.locale}-${country}` : null,
    ...preferred,
    input.locale,
  ].filter((tag): tag is string => typeof tag === "string" && tag.length > 0);

  const timeFormat =
    candidates.map(timeFormatOf).find((value) => value !== null) ??
    NEUTRAL_DEFAULTS.timeFormat;

  // ————— Température —————
  //
  // Le pays d'abord ; à défaut, la première région déclarée dans
  // `Accept-Language`. Sans région du tout, Celsius : c'est le cas du reste du
  // monde, et le choix produit d'origine.
  const region = country ?? preferred.map(regionOf).find(Boolean) ?? null;
  const temperatureUnit: TemperatureUnit =
    region && FAHRENHEIT_COUNTRIES.has(region) ? "fahrenheit" : "celsius";

  return { timeFormat, temperatureUnit };
}

/** `us` → `US`, et rien d'autre qu'un code à deux lettres. */
function normalizeCountry(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  // ⚠️ Cloudflare rend `XX` pour un client dont il ignore le pays, et `T1` pour
  // Tor. Les deux passent le test de forme et doivent être écartés.
  if (!/^[A-Z]{2}$/.test(code) || code === "XX" || code === "T1") return null;
  return code;
}
