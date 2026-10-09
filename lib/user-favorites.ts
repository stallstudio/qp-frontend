import type { FavoriteType } from "@/lib/generated/user-client";
import type { FavoritesPayload } from "@/types/user";
import {
  emptyFavoritesPayload,
  FAV_NAMESPACES,
  type FavNamespace,
} from "@/lib/favorites-storage";

// Correspondance entre les namespaces côté client ("parks") et le type stocké en
// base ("park"). Une seule table de vérité pour les deux sens.
export const NAMESPACE_TO_TYPE: Record<FavNamespace, FavoriteType> = {
  parks: "park",
  rides: "ride",
  shows: "show",
  restaurants: "restaurant",
  shops: "shop",
  hotels: "hotel",
  services: "service",
};

const TYPE_TO_NAMESPACE = new Map<FavoriteType, FavNamespace>(
  FAV_NAMESPACES.map((namespace) => [NAMESPACE_TO_TYPE[namespace], namespace]),
);

// Regroupe les favoris (lignes { type, key }) en { parks: [...], rides: [...] },
// le format attendu par le front (miroir des namespaces localStorage).
export function groupFavorites(
  rows: { type: FavoriteType; key: string }[],
): FavoritesPayload {
  const payload = emptyFavoritesPayload();
  for (const row of rows) {
    const namespace = TYPE_TO_NAMESPACE.get(row.type);
    if (namespace) payload[namespace].push(row.key);
  }
  return payload;
}
