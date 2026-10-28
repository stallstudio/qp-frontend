import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { dispatchFetch, relay } from "@/lib/dispatch";
import type { PoiFavNamespace } from "@/lib/favorites-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Résolution des CLÉS de favoris (stockées en localStorage / compte) vers des noms
// affichables, pour le popup « Mes favoris » du profil. Les favoris ne stockent
// que des identifiants :
//   - parcs : `{identifier}`
//   - spectacles : `{parkIdentifier}:{showName}`
//   - toutes les autres familles de POI (attractions, restaurants, boutiques…) :
//     `{parkIdentifier}:{poiId}`
// La traduction en noms est faite par l'API Dispatch (`/v1/favorites/resolve`),
// qui omet les clés qui ne résolvent pas (POI supprimé, etc.). Le compte, lui,
// reste vérifié ici : les favoris appartiennent aux comptes de Queue Park.
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

export async function POST(request: NextRequest) {
  const { userId, response } = await requireUserId();
  if (!userId) return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return relay(
    await dispatchFetch("/v1/favorites/resolve", { raw: await request.text() }),
  );
}
