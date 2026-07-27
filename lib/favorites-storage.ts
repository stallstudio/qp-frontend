// CACHE d'affichage des favoris dans localStorage.
//
// ⚠️ Ce n'est PAS la source de vérité : les favoris exigent un compte et vivent
// en base (voir `components/providers/favorites-provider.tsx`). Ce cache sert
// uniquement à peindre les étoiles au bon état dès le premier rendu, sans
// attendre la session puis la requête réseau — sans lui, chaque chargement
// afficherait brièvement des favoris vides.
//
// Namespaces : "parks" (key = park.identifier), "rides" (key = "{parkIdentifier}:{rideId}")
// et "shows" (key = "{parkIdentifier}:{showName}").

import type { FavoritesPayload } from "@/types/user";

export const FAV_STORAGE_PREFIX = "qp:fav:";
export const FAV_NAMESPACES = ["parks", "rides", "shows"] as const;
export type FavNamespace = (typeof FAV_NAMESPACES)[number];

// Plafond de parcs favoris : au-delà, la page d'accueil devient vite trop
// chargée. Appliqué CÔTÉ SERVEUR (PATCH /api/user/favorites) ; le client s'en
// sert seulement pour afficher le compteur « x/20 ».
export const PARK_FAVORITES_LIMIT = 20;
export const FAV_LIMITS: Partial<Record<string, number>> = {
  parks: PARK_FAVORITES_LIMIT,
};

function readNamespace(namespace: FavNamespace): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FAV_STORAGE_PREFIX + namespace);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function readFavoritesCache(): FavoritesPayload {
  return {
    parks: readNamespace("parks"),
    rides: readNamespace("rides"),
    shows: readNamespace("shows"),
  };
}

export function writeFavoritesCache(payload: FavoritesPayload): void {
  if (typeof window === "undefined") return;
  try {
    for (const namespace of FAV_NAMESPACES) {
      window.localStorage.setItem(
        FAV_STORAGE_PREFIX + namespace,
        JSON.stringify(payload[namespace] ?? []),
      );
    }
  } catch {
    // localStorage indisponible (navigation privée, quota) : le provider garde
    // l'état en mémoire, on perd seulement l'affichage instantané au rechargement.
  }
}

export function clearFavoritesCache(): void {
  if (typeof window === "undefined") return;
  try {
    for (const namespace of FAV_NAMESPACES) {
      window.localStorage.removeItem(FAV_STORAGE_PREFIX + namespace);
    }
  } catch {
    // idem : rien de critique.
  }
}
