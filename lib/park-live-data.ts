import { cache } from "react";
import { getPrisma } from "@/lib/prisma";
import {
  calculateParkDate,
  getOpeningHoursByParkAndDate,
} from "@/lib/opening-hours";
import { getLatestWaitTimesByPark } from "@/lib/wait-times";
import { getShowTimesByParkAndDates } from "@/lib/show-times";
import { limitShowsToSessions } from "@/lib/show-window";
import { getWeatherByParkAndDate } from "@/lib/weather";
import { getParkEventsByDate } from "@/lib/park-events-db";
import { isAdminViewer } from "@/lib/auth-helpers";
import { cachedForTtl } from "@/lib/process-cache";
import { readCollectionCycle } from "@/lib/collection-cycle-db";
import { delayFromEstimate, snapshotTtlMs } from "@/lib/collection-cycle";
import type { CoverImage, ParkLiveData, ParkWeather } from "@/types/api";

// Construction des données « live » d'un parc (temps d'attente, spectacles,
// horaires, météo).
//
// Extrait de `app/api/park/[parkId]/route.ts` pour être appelé DIRECTEMENT par
// le composant serveur de la page parc : celle-ci n'a plus à passer par une
// requête HTTP vers sa propre API pour afficher son contenu initial. La route
// API reste, elle sert au rafraîchissement automatique côté client.

export type ParkLiveResult =
  | { status: "ok"; data: ParkLiveData }
  | { status: "not-found" }
  | { status: "error"; reason: string };

/**
 * Ce qui est réellement mis en cache : tout SAUF les deux DURÉES.
 *
 * ⚠️ Cette exclusion est la raison d'être du type. `nextUpdateIn` et
 * `dataAgeSeconds` courent tous les deux : les garder en cache dix secondes les
 * servirait périmés d'autant — un âge de donnée figé serait même faux à l'œil nu.
 * Et pour `nextUpdateIn`, mutualiser la valeur donnerait le même délai à tous
 * les visiteurs servis dans la fenêtre, qui reviendraient donc ensemble. Les
 * deux sont recalculés à chaque réponse.
 */
type ParkLiveSnapshot =
  | { status: "ok"; data: Omit<ParkLiveData, "nextUpdateIn" | "dataAgeSeconds"> }
  | { status: "not-found" }
  | { status: "error"; reason: string };

/**
 * Durée de mutualisation d'un parc entre visiteurs.
 *
 * Le worker écrit au mieux une fois par minute : deux cents visiteurs du même
 * parc n'ont aucune raison d'émettre deux cents fois les huit mêmes requêtes
 * dans la même seconde pour obtenir le même octet. Dix secondes suffisent à
 * absorber une rafale sans qu'aucune donnée servie ne soit sensiblement plus
 * vieille que ce que la page affiche déjà.
 */
const LIVE_DATA_TTL_MS = 10_000;

// Métadonnées du parc utiles hors « live » : SEO, JSON-LD, vignette de partage.
export type ParkIdentity = {
  id: number;
  identifier: string;
  name: string;
  timezone: string;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  cover: CoverImage[] | null;
  lastUpdatedAt: Date | null;
  queueTypeLabels: Record<string, string> | null;
  currentTemp: number | null;
  currentWeatherCode: number | null;
  // Faux = parc masqué du site, rendu ici parce qu'un admin le prévisualise.
  // C'est ce qui permet à la page d'afficher son bandeau d'avertissement.
  display: boolean;
};

/**
 * Date de rangement suivante, en YYYY-MM-DD.
 *
 * ⚠️ Arithmétique en UTC sur une date NUE, sans fuseau : `2026-08-25` suivi de
 * `2026-08-26`, où que soit le parc. Passer par son fuseau n'apporterait rien —
 * on ne cherche pas un instant, mais l'étiquette du casier d'à côté.
 */
function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function normalizeCover(raw: unknown): CoverImage[] | null {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return null;
  return raw.map((item: unknown) => {
    if (typeof item === "string") return { url: item, credit: null };
    if (typeof item === "object" && item !== null && "url" in item) {
      const obj = item as { url: string; credit?: string | null };
      return { url: obj.url, credit: obj.credit ?? null };
    }
    return { url: String(item), credit: null };
  });
}

/**
 * Parc affichable, par identifiant.
 *
 * Mémoïsé par `cache()` pour la durée d'UNE requête : `generateMetadata`, le
 * JSON-LD, l'image de partage et la page elle-même en ont tous besoin, mais une
 * seule requête SQL est émise. Renvoie `null` si le parc n'existe pas (ou n'est
 * pas affichable) et `undefined` si la base est injoignable — la distinction
 * évite de transformer une panne passagère en 404 définitive.
 *
 * `includeHidden` lève le filtre `display: true` pour l'aperçu admin. Il n'est
 * JAMAIS déduit ici : c'est `resolveParkForViewer` qui décide, et lui seul lit
 * la session.
 *
 * ⚠️ **La clé de mémoïsation inclut `includeHidden`.** Deux appels au même parc
 * avec des valeurs différentes émettent deux requêtes SQL — d'où le repli en
 * deux temps plutôt qu'un `includeHidden` calculé au petit bonheur par chaque
 * appelant.
 */
export const getParkIdentity = cache(
  async (
    identifier: string,
    includeHidden = false,
  ): Promise<ParkIdentity | null | undefined> => {
    try {
      const park = await getPrisma().park.findUnique({
        where: includeHidden ? { identifier } : { identifier, display: true },
        select: {
          id: true,
          identifier: true,
          name: true,
          timezone: true,
          city: true,
          country: true,
          latitude: true,
          longitude: true,
          cover: true,
          lastUpdatedAt: true,
          queueTypeLabels: true,
          currentTemp: true,
          currentWeatherCode: true,
          display: true,
        },
      });
      if (!park) return null;
      return {
        ...park,
        cover: normalizeCover(park.cover),
        queueTypeLabels: park.queueTypeLabels as Record<string, string> | null,
      };
    } catch (error) {
      console.error(`Failed to load park ${identifier}`, error);
      return undefined;
    }
  },
);

/**
 * Construction proprement dite, hors cache. Ne pas appeler directement :
 * `buildParkLiveData` l'enveloppe des deux caches qui la rendent supportable
 * en charge.
 */
async function buildParkLiveSnapshot(
  identifier: string,
  includeHidden: boolean,
): Promise<ParkLiveSnapshot> {
  const park = await getParkIdentity(identifier, includeHidden);
  if (park === undefined) return { status: "error", reason: "database" };
  if (park === null) return { status: "not-found" };

  const today = await calculateParkDate(park.id, park.timezone);
  if (!today) {
    return { status: "error", reason: `Invalid timezone: ${park.timezone}` };
  }

  // Requêtes indépendantes : lancées en parallèle plutôt qu'en série (c'était
  // quatre allers-retours enchaînés dans la route d'origine).
  //
  // ⚠️ Les spectacles se chargent sur DEUX dates de rangement : une séance qui
  // dépasse minuit range ses dernières représentations sous le lendemain (voir
  // `getShowTimesByParkAndDates`). Elles sont retriées juste après sur les
  // horaires, jamais sur la date.
  const [waitTimes, showTimes, openingHours, daily] = await Promise.all([
    getLatestWaitTimesByPark(park.id, park.lastUpdatedAt),
    getShowTimesByParkAndDates(park.id, [today, nextDay(today)]),
    getOpeningHoursByParkAndDate(park.id, today),
    getWeatherByParkAndDate(park.id, today),
  ]);

  // ⚠️ EN SÉRIE, à dessein : les horaires portent l'`eventId` de chaque
  // session, donc la fenêtre du jour de chaque événement. Les charger d'abord
  // évite une seconde requête sur `opening_hours`.
  const events = await getParkEventsByDate(park.id, today, openingHours ?? []);

  // Chaque créneau est rendu à la SÉANCE qui le contient — un spectacle
  // d'événement à celles de son événement, les autres à l'exploitation de
  // jour. C'est ce qui retire les représentations de la nuit PRÉCÉDENTE, que
  // leur date calendaire range sous aujourd'hui, et ce qui garde celles de la
  // nuit en cours, rangées sous demain.
  const shows = limitShowsToSessions(showTimes ?? [], openingHours ?? []);

  // Fusion météo « live » (courant, ligne Park) + prévision du jour (daily).
  // `null` seulement si on n'a NI courant NI prévision.
  const hasWeather =
    park.currentTemp != null || park.currentWeatherCode != null || daily != null;
  const weather: ParkWeather | null = hasWeather
    ? {
        currentTemp: park.currentTemp,
        currentWeatherCode: park.currentWeatherCode,
        tempMin: daily?.tempMin ?? null,
        tempMax: daily?.tempMax ?? null,
        weatherCode: daily?.weatherCode ?? null,
      }
    : null;

  return {
    status: "ok",
    data: {
      identifier: park.identifier,
      name: park.name,
      timezone: park.timezone,
      cover: park.cover,
      queueTypeLabels: park.queueTypeLabels,
      openingHours: openingHours ?? [],
      waitTimes,
      shows,
      weather,
      events,
      lastUpdate:
        park.lastUpdatedAt?.toISOString() ?? new Date().toISOString(),
    },
  };
}

/**
 * Données live complètes d'un parc déjà résolu.
 *
 * Trois protections empilées, chacune contre une rafale différente :
 *
 * 1. `cache()` de React — une même requête (page, JSON-LD, image de partage) ne
 *    construit qu'une fois. Portée : une requête.
 * 2. `cachedForTtl` — tous les visiteurs d'un même parc partagent la même
 *    construction pendant dix secondes. C'est ce qui décorrèle le coût en base
 *    du nombre de visiteurs : il devient fonction des parcs consultés.
 * 3. `nextUpdateIn`, recalculé ici et JAMAIS mis en cache, qui étale les
 *    retours de chacun au lieu de les faire converger.
 *
 * ⚠️ **Une réponse d'erreur n'est pas mise en cache** : une base momentanément
 * injoignable ne doit pas être resservie à tout le monde pendant dix secondes.
 * Un `not-found`, lui, l'est — c'est une réponse stable, et la marteler n'a
 * aucun intérêt.
 *
 * ⚠️ La clé inclut `includeHidden`, même réserve que `getParkIdentity` : l'aperçu
 * admin d'un parc masqué ne doit jamais partager son entrée avec le public.
 */
export const buildParkLiveData = cache(
  async (identifier: string, includeHidden = false): Promise<ParkLiveResult> => {
    // Lu AVANT la construction, et pas en parallèle : c'est lui qui dit combien
    // de temps le résultat pourra être gardé sans risquer d'enjamber la
    // prochaine écriture du worker. Sa propre lecture est mutualisée dix
    // secondes, le surcoût est donc nul en pratique.
    const cycle = await readCollectionCycle();

    const snapshot = await cachedForTtl(
      `park-live:${identifier}:${includeHidden}`,
      snapshotTtlMs(cycle, Date.now(), LIVE_DATA_TTL_MS),
      () => buildParkLiveSnapshot(identifier, includeHidden),
      (result) => result.status !== "error",
    );

    if (snapshot.status !== "ok") return snapshot;

    // Évalué ici, au plus tard : c'est un délai qui court, et son jitter doit
    // être propre à cette réponse-ci. Ancré sur l'horodatage de la donnée qu'on
    // s'apprête à servir — la suivante arrive une minute après CELLE-CI, pas une
    // minute après l'instant de la requête.
    const parsed = Date.parse(snapshot.data.lastUpdate);
    const lastUpdateMs = Number.isNaN(parsed) ? null : parsed;
    const servedAt = Date.now();

    const nextUpdateIn = delayFromEstimate(cycle, servedAt, lastUpdateMs);

    // Hors cache, comme `nextUpdateIn` : c'est une durée qui court, la mettre
    // en cache la servirait périmée de sa durée de vie.
    const dataAgeSeconds =
      lastUpdateMs == null
        ? 0
        : Math.max(0, Math.round((servedAt - lastUpdateMs) / 1000));

    return {
      status: "ok",
      data: { ...snapshot.data, nextUpdateIn, dataAgeSeconds },
    };
  },
);

/**
 * Parc du point de vue de CELUI QUI REGARDE : le parc affichable, ou — pour un
 * admin seulement — le parc masqué, rendu comme s'il était publié.
 *
 * ⚠️ **La session n'est lue QUE si le parc est introuvable autrement.** C'est
 * tout l'intérêt du repli en deux temps : un visiteur d'un parc publié, y compris
 * à chacun de ses rafraîchissements, ne déclenche aucune requête de session. Le second aller-retour SQL n'existe que sur un parc masqué, cas rare
 * par construction.
 *
 * `undefined` (base injoignable) est propagé tel quel, sans consulter la session :
 * une panne ne doit pas devenir un 404.
 */
export async function resolveParkForViewer(
  identifier: string,
): Promise<ParkIdentity | null | undefined> {
  const park = await getParkIdentity(identifier);
  if (park !== null) return park;
  if (!(await isAdminViewer())) return null;
  return getParkIdentity(identifier, true);
}

/**
 * Même repli que `resolveParkForViewer`, pour les données live complètes.
 *
 * Le « ce parc est masqué » dont la page a besoin pour son bandeau se lit sur
 * `ParkIdentity.display` — inutile de le renvoyer une seconde fois ici.
 */
export async function buildParkLiveDataForViewer(
  identifier: string,
): Promise<ParkLiveResult> {
  const result = await buildParkLiveData(identifier);
  if (result.status !== "not-found") return result;
  if (!(await isAdminViewer())) return result;
  return buildParkLiveData(identifier, true);
}
