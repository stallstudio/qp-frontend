import type { FavoriteType } from "@/lib/generated/user-client";
import type { FavoritesPayload } from "@/types/user";

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

// Normalise un payload réseau en liste de favoris typés, en dédoublonnant.
export function flattenFavorites(
  input: unknown,
): { type: FavoriteType; key: string }[] {
  const data = (input ?? {}) as Record<string, unknown>;
  const out: { type: FavoriteType; key: string }[] = [];
  const seen = new Set<string>();

  const collect = (type: FavoriteType, values: unknown) => {
    if (!Array.isArray(values)) return;
    for (const value of values) {
      if (typeof value !== "string" || !value) continue;
      const dedupeKey = `${type}:${value}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      out.push({ type, key: value });
    }
  };

  collect("park", data.parks);
  collect("ride", data.rides);
  collect("show", data.shows);
  return out;
}
