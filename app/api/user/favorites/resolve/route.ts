import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { getPrisma } from "@/lib/prisma";
import {
  FAV_NAMESPACES,
  type PoiFavNamespace,
} from "@/lib/favorites-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Résolution des CLÉS de favoris (stockées en localStorage / compte) vers des noms
// affichables, pour le popup « Mes favoris » du profil. Les favoris ne stockent
// que des identifiants :
//   - parcs : `{identifier}`
//   - spectacles : `{parkIdentifier}:{showName}`
//   - toutes les autres familles de POI (attractions, restaurants, boutiques…) :
//     `{parkIdentifier}:{poiId}`
// On les traduit ici via la base principale (Poi.name + Park.name). Les clés qui
// ne résolvent pas (POI supprimé, etc.) sont simplement omises.
//
// Entrée : POST { parks?: string[], shows?: string[], rides?: string[],
//                 restaurants?: string[], … } — un tableau par namespace.
// Sortie : { parks: [{ key, name }], <namespace>: [{ key, name, parkName }] }

export type ResolvedPark = { key: string; name: string };
// Spectacle : la clé porte DÉJÀ le nom ; seul le nom du parc est résolu.
export type ResolvedPoi = { key: string; name: string; parkName: string };
export type ResolvedFavorites = { parks: ResolvedPark[] } & Record<
  PoiFavNamespace,
  ResolvedPoi[]
>;

// Les namespaces dont la clé porte l'identifiant du POI.
const ID_NAMESPACES = FAV_NAMESPACES.filter(
  (namespace): namespace is Exclude<PoiFavNamespace, "shows"> =>
    namespace !== "parks" && namespace !== "shows",
);

function parseIdKey(key: string): { parkIdentifier: string; poiId: number } | null {
  const idx = key.lastIndexOf(":");
  if (idx <= 0) return null;
  const poiId = Number(key.slice(idx + 1));
  if (!Number.isInteger(poiId)) return null;
  return { parkIdentifier: key.slice(0, idx), poiId };
}

// Clé spectacle : le nom peut contenir « : », mais l'identifiant de parc non — on
// coupe donc sur le PREMIER « : ».
function parseShowKey(
  key: string,
): { parkIdentifier: string; showName: string } | null {
  const idx = key.indexOf(":");
  if (idx <= 0 || idx >= key.length - 1) return null;
  return { parkIdentifier: key.slice(0, idx), showName: key.slice(idx + 1) };
}

export async function POST(request: NextRequest) {
  const { userId, response } = await requireUserId();
  if (!userId) return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const keysOf = (namespace: string): string[] => {
    const value = body?.[namespace];
    return Array.isArray(value)
      ? value.filter((k): k is string => typeof k === "string")
      : [];
  };

  const parkKeys = keysOf("parks");
  const showParsed = keysOf("shows").flatMap((key) => {
    const parsed = parseShowKey(key);
    return parsed ? [{ key, parsed }] : [];
  });
  const idParsed = ID_NAMESPACES.map((namespace) => ({
    namespace,
    entries: keysOf(namespace).flatMap((key) => {
      const parsed = parseIdKey(key);
      return parsed ? [{ key, parsed }] : [];
    }),
  }));
  const poiIds = [
    ...new Set(
      idParsed.flatMap(({ entries }) => entries.map((e) => e.parsed.poiId)),
    ),
  ];

  const prisma = getPrisma();
  // Types explicites des branches vides : sans ça, `Promise.resolve([])` élargit
  // le résultat à `never[]`/`any[]` et `.map(...)` ne produit plus des tuples
  // `[clé, valeur]` mais `any[]`, ce que `new Map()` refuse.
  type ParkRow = { identifier: string; name: string };
  type PoiRow = { id: number; name: string; park: { name: string } | null };
  // Identifiants de parc à résoudre : ceux des favoris « parc » ET ceux portés par
  // les clés de spectacles (pour le nom de parc de leur en-tête de groupe).
  const parkIdentifiersToResolve = [
    ...new Set([
      ...parkKeys,
      ...showParsed.map((s) => s.parsed.parkIdentifier),
    ]),
  ];
  const [parkRows, poiRows] = await Promise.all([
    parkIdentifiersToResolve.length
      ? prisma.park.findMany({
          where: { identifier: { in: parkIdentifiersToResolve } },
          select: { identifier: true, name: true },
        })
      : Promise.resolve([] as ParkRow[]),
    // ⚠️ Pas de filtre sur `kind` : un identifiant de POI est unique dans
    // toute la table depuis la migration du 2026-08-21, et un POI reclassé
    // dans l'admin (un restaurant devenu boutique) doit garder son nom ici.
    poiIds.length
      ? prisma.poi.findMany({
          where: { id: { in: poiIds } },
          select: { id: true, name: true, park: { select: { name: true } } },
        })
      : Promise.resolve([] as PoiRow[]),
  ]);

  const parkNameByIdentifier = new Map(
    parkRows.map((p) => [p.identifier, p.name] as const),
  );
  const poiById = new Map(poiRows.map((r) => [r.id, r] as const));

  // On préserve l'ordre d'entrée et on omet ce qui ne résout pas.
  const result = {
    parks: parkKeys.flatMap((key) => {
      const name = parkNameByIdentifier.get(key);
      return name ? [{ key, name }] : [];
    }),
    // Spectacles : le nom vient de la clé ; le nom du parc de la base (repli sur
    // l'identifiant si le parc n'est plus affiché).
    shows: showParsed.map(({ key, parsed }) => ({
      key,
      name: parsed.showName,
      parkName:
        parkNameByIdentifier.get(parsed.parkIdentifier) ??
        parsed.parkIdentifier,
    })),
  } as ResolvedFavorites;
  for (const { namespace, entries } of idParsed) {
    result[namespace] = entries.flatMap(({ key, parsed }) => {
      const poi = poiById.get(parsed.poiId);
      return poi
        ? [{ key, name: poi.name, parkName: poi.park?.name ?? "" }]
        : [];
    });
  }

  return NextResponse.json(result);
}
