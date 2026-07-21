import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Résolution des CLÉS de favoris (stockées en localStorage / compte) vers des noms
// affichables, pour le popup « Mes favoris » du profil. Les favoris ne stockent
// que des identifiants :
//   - parcs : `{identifier}`
//   - attractions : `{parkIdentifier}:{rideId}`
// On les traduit ici via la base principale (Ride.name + Park.name). Les clés qui
// ne résolvent pas (attraction supprimée, etc.) sont simplement omises.
//
// Entrée : POST { parks: string[], rides: string[] }
// Sortie : { parks: [{ key, name }], rides: [{ key, rideName, parkName }] }

export type ResolvedPark = { key: string; name: string };
export type ResolvedRide = { key: string; rideName: string; parkName: string };
// Spectacle : la clé porte DÉJÀ le nom (`{parkIdentifier}:{showName}`) ; seul le
// nom du parc doit être résolu depuis la base principale.
export type ResolvedShow = { key: string; showName: string; parkName: string };

function parseRideKey(key: string): { parkIdentifier: string; rideId: number } | null {
  const idx = key.lastIndexOf(":");
  if (idx <= 0) return null;
  const rideId = Number(key.slice(idx + 1));
  if (!Number.isInteger(rideId)) return null;
  return { parkIdentifier: key.slice(0, idx), rideId };
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

  const body = (await request.json().catch(() => null)) as {
    parks?: unknown;
    rides?: unknown;
    shows?: unknown;
  } | null;
  const parkKeys = Array.isArray(body?.parks)
    ? body!.parks.filter((k): k is string => typeof k === "string")
    : [];
  const rideKeys = Array.isArray(body?.rides)
    ? body!.rides.filter((k): k is string => typeof k === "string")
    : [];
  const showKeys = Array.isArray(body?.shows)
    ? body!.shows.filter((k): k is string => typeof k === "string")
    : [];

  const rideParsed = rideKeys
    .map((key) => ({ key, parsed: parseRideKey(key) }))
    .filter((r): r is { key: string; parsed: NonNullable<ReturnType<typeof parseRideKey>> } => r.parsed !== null);
  const rideIds = [...new Set(rideParsed.map((r) => r.parsed.rideId))];

  const showParsed = showKeys
    .map((key) => ({ key, parsed: parseShowKey(key) }))
    .filter((r): r is { key: string; parsed: NonNullable<ReturnType<typeof parseShowKey>> } => r.parsed !== null);

  const prisma = getPrisma();
  // Types explicites des branches vides : sans ça, `Promise.resolve([])` élargit
  // le résultat à `never[]`/`any[]` et `.map(...)` ne produit plus des tuples
  // `[clé, valeur]` mais `any[]`, ce que `new Map()` refuse.
  type ParkRow = { identifier: string; name: string };
  type RideRow = { id: number; name: string; park: { name: string } | null };
  // Identifiants de parc à résoudre : ceux des favoris « parc » ET ceux portés par
  // les clés de spectacles (pour le nom de parc de leur en-tête de groupe).
  const parkIdentifiersToResolve = [
    ...new Set([
      ...parkKeys,
      ...showParsed.map((s) => s.parsed.parkIdentifier),
    ]),
  ];
  const [parkRows, rideRows] = await Promise.all([
    parkIdentifiersToResolve.length
      ? prisma.park.findMany({
          where: { identifier: { in: parkIdentifiersToResolve } },
          select: { identifier: true, name: true },
        })
      : Promise.resolve([] as ParkRow[]),
    rideIds.length
      ? prisma.ride.findMany({
          where: { id: { in: rideIds } },
          select: { id: true, name: true, park: { select: { name: true } } },
        })
      : Promise.resolve([] as RideRow[]),
  ]);

  const parkNameByIdentifier = new Map(
    parkRows.map((p) => [p.identifier, p.name] as const),
  );
  const rideById = new Map(rideRows.map((r) => [r.id, r] as const));

  // On préserve l'ordre d'entrée et on omet ce qui ne résout pas.
  const parks: ResolvedPark[] = parkKeys.flatMap((key) => {
    const name = parkNameByIdentifier.get(key);
    return name ? [{ key, name }] : [];
  });
  const rides: ResolvedRide[] = rideParsed.flatMap(({ key, parsed }) => {
    const r = rideById.get(parsed.rideId);
    return r ? [{ key, rideName: r.name, parkName: r.park?.name ?? "" }] : [];
  });
  // Spectacles : le nom vient de la clé ; le nom du parc de la base (repli sur
  // l'identifiant si le parc n'est plus affiché).
  const shows: ResolvedShow[] = showParsed.map(({ key, parsed }) => ({
    key,
    showName: parsed.showName,
    parkName:
      parkNameByIdentifier.get(parsed.parkIdentifier) ?? parsed.parkIdentifier,
  }));

  return NextResponse.json({ parks, rides, shows });
}
