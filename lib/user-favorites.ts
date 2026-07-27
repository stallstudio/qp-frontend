import type { FavoriteType } from "@/lib/generated/user-client";
import type { FavoritesPayload } from "@/types/user";
import type { FavNamespace } from "@/lib/favorites-storage";

// Correspondance entre les namespaces côté client ("parks") et le type stocké en
// base ("park"). Une seule table de vérité pour les deux sens.
export const NAMESPACE_TO_TYPE: Record<FavNamespace, FavoriteType> = {
  parks: "park",
  rides: "ride",
  shows: "show",
};

// Regroupe les favoris (lignes { type, key }) en { parks: [...], rides: [...] },
// le format attendu par le front (miroir des namespaces localStorage).
export function groupFavorites(
  rows: { type: FavoriteType; key: string }[],
): FavoritesPayload {
  const parks: string[] = [];
  const rides: string[] = [];
  const shows: string[] = [];
  for (const row of rows) {
    if (row.type === "park") parks.push(row.key);
    else if (row.type === "show") shows.push(row.key);
    else rides.push(row.key);
  }
  return { parks, rides, shows };
}

