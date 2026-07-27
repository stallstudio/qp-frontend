import { DateTime } from "luxon";
import { getPrisma } from "@/lib/prisma";
import { fetchOpeningHoursForParks } from "@/lib/opening-hours";
import { getWhitelistedIps } from "@/lib/ip-rules";
import { normalizeCover } from "@/lib/park-live-data";
import { getCountryName } from "@/lib/utils";
import type { ParkList } from "@/types/api";

// Liste des parcs + classement « populaires », partagés par la page d'accueil
// (composant serveur) et par `GET /api/parks` (rafraîchissement client).

// ————————————————————— Cache mémoire de la liste des parcs —————————————————
// La liste des parcs et leurs horaires du jour ne bougent que quelques fois par
// jour, mais étaient reconstruits À CHAQUE chargement de l'accueil (une requête
// `parks` + la résolution des horaires de TOUS les parcs).
//
// Cache EN MÉMOIRE volontairement (et pas `unstable_cache`) : les horaires
// portent des `Date`, qu'une sérialisation JSON transformerait silencieusement
// en chaînes.
const PARKS_CACHE_TTL_MS = 5 * 60_000;

const globalForParks = globalThis as unknown as {
  parksCache: { parks: ParkList[]; fetchedAt: number } | undefined;
};

async function loadParks(): Promise<ParkList[]> {
  const prisma = getPrisma();

  const parks = await prisma.park.findMany({
    where: { display: true },
    select: {
      id: true,
      identifier: true,
      name: true,
      timezone: true,
      cover: true,
      badge: true,
      country: true,
      group: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  const openingHoursByPark = await fetchOpeningHoursForParks(parks);

  // Cast assumé : la forme renvoyée est celle que le client consomme depuis
  // toujours (`ParkList`), mais Prisma type `badge`/`country` en `string | null`
  // là où l'interface les déclare optionnels/non nuls. Comportement d'exécution
  // strictement identique à l'ancienne route, qui sérialisait cet objet tel quel.
  return parks.map((park) => ({
    ...park,
    cover: normalizeCover(park.cover) ?? [],
    openingHours: openingHoursByPark.get(park.id) || [],
    // Résolu ici, une seule fois : `Intl.DisplayNames` ne donne pas le même
    // libellé sous Node et dans le navigateur (voir `getCountryName`), et le
    // recalculer dans un composant client casserait l'hydratation.
    countryName: getCountryName(park.country ?? ""),
  })) as unknown as ParkList[];
}

export async function getParksWithHours(): Promise<ParkList[]> {
  const cache = globalForParks.parksCache;
  if (cache && Date.now() - cache.fetchedAt < PARKS_CACHE_TTL_MS) {
    return cache.parks;
  }
  const parks = await loadParks();
  globalForParks.parksCache = { parks, fetchedAt: Date.now() };
  return parks;
}

/**
 * Identifiants des parcs les plus consultés sur les 2 dernières heures.
 * Volontairement PAS mis en cache avec la liste : c'est la partie « vivante ».
 */
export async function getPopularParkIdentifiers(
  displayable: Set<string>,
): Promise<string[]> {
  const prisma = getPrisma();
  const twoHoursAgo = DateTime.now().minus({ hours: 2 }).toJSDate();
  const whitelistedIps = await getWhitelistedIps();

  const rows = await prisma.apiRequestLog.groupBy({
    by: ["parkId"],
    where: {
      createdAt: { gte: twoHoursAgo },
      statusCode: 200,
      parkId: { not: null },
      ...(whitelistedIps.length > 0 && {
        ipAddress: { notIn: whitelistedIps },
      }),
    },
    _count: { parkId: true },
    orderBy: { _count: { parkId: "desc" } },
    take: 8,
  });

  return rows
    .map((row) => row.parkId)
    .filter((id): id is string => id !== null && displayable.has(id))
    .slice(0, 6);
}

export type HomeData = {
  parks: ParkList[];
  popularParks: string[];
};

export async function getHomeData(): Promise<HomeData> {
  const parks = await getParksWithHours();
  const popularParks = await getPopularParkIdentifiers(
    new Set(parks.map((p) => p.identifier)),
  );
  return { parks, popularParks };
}
