import { cache } from "react";
import { getPrisma } from "@/lib/prisma";
import {
  calculateParkDate,
  getOpeningHoursByParkAndDate,
} from "@/lib/opening-hours";
import { getLatestWaitTimesByPark } from "@/lib/wait-times";
import { getShowTimesByParkAndDate } from "@/lib/show-times";
import { getWeatherByParkAndDate } from "@/lib/weather";
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
};

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
 */
export const getParkIdentity = cache(
  async (identifier: string): Promise<ParkIdentity | null | undefined> => {
    try {
      const park = await getPrisma().park.findUnique({
        where: { identifier, display: true },
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
 * Données live complètes d'un parc déjà résolu. Mémoïsé lui aussi : la page et
 * l'image de partage peuvent le demander dans la même requête.
 */
export const buildParkLiveData = cache(
  async (identifier: string): Promise<ParkLiveResult> => {
    const park = await getParkIdentity(identifier);
    if (park === undefined) return { status: "error", reason: "database" };
    if (park === null) return { status: "not-found" };

    const today = await calculateParkDate(park.id, park.timezone);
    if (!today) {
      return { status: "error", reason: `Invalid timezone: ${park.timezone}` };
    }

    // Requêtes indépendantes : lancées en parallèle plutôt qu'en série (c'était
    // quatre allers-retours enchaînés dans la route d'origine).
    const [waitTimes, showTimes, openingHours, daily] = await Promise.all([
      getLatestWaitTimesByPark(park.id, park.lastUpdatedAt),
      getShowTimesByParkAndDate(park.id, today),
      getOpeningHoursByParkAndDate(park.id, today),
      getWeatherByParkAndDate(park.id, today),
    ]);

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
        shows: showTimes ?? [],
        weather,
        lastUpdate:
          park.lastUpdatedAt?.toISOString() ?? new Date().toISOString(),
      },
    };
  },
);
