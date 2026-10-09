// CACHE d'affichage des favoris dans localStorage.
//
// ⚠️ Ce n'est PAS la source de vérité : les favoris exigent un compte et vivent
// en base (voir `components/providers/favorites-provider.tsx`). Ce cache sert
// uniquement à peindre les étoiles au bon état dès le premier rendu, sans
// attendre la session puis la requête réseau — sans lui, chaque chargement
// afficherait brièvement des favoris vides.
//
// Namespaces : "parks" (key = park.identifier), puis un par famille de POI —
// "rides", "restaurants", "shops", "hotels", "services" (key =
// "{parkIdentifier}:{poiId}") et "shows" (key = "{parkIdentifier}:{showName}").
// Voir `poiFavorite` pour passer d'un POI à sa clé.

import type { FavoritesPayload } from "@/types/user";
import type { PoiKind } from "@/lib/poi-kinds";

export const FAV_STORAGE_PREFIX = "qp:fav:";
export const FAV_NAMESPACES = [
  "parks",
  "rides",
  "shows",
  "restaurants",
  "shops",
  "hotels",
  "services",
] as const;
export type FavNamespace = (typeof FAV_NAMESPACES)[number];

/** Les namespaces des POI, c'est-à-dire tous sauf les parcs. */
export type PoiFavNamespace = Exclude<FavNamespace, "parks">;

// ⚠️ **Un namespace PAR FAMILLE, et non un seul « pois »** : c'est le modèle
// qu'avaient déjà les attractions et les spectacles, et c'est ce qui laisse le
// profil compter et lister chaque famille sans relire la base principale.
export const FAV_NAMESPACE_BY_KIND: Record<PoiKind, PoiFavNamespace> = {
  ride: "rides",
  show: "shows",
  restaurant: "restaurants",
  shop: "shops",
  hotel: "hotels",
  service: "services",
};

/**
 * Le namespace et la clé de favori d'un POI.
 *
 * ⚠️ **Un spectacle se repère à son NOM**, tous les autres à leur identifiant :
 * les favoris de spectacles datent d'avant la table `pois`, quand un spectacle
 * n'avait pas d'identifiant stable. Les deux formes cohabitent pour ne rien
 * faire perdre aux comptes existants.
 */
export function poiFavorite(
  parkIdentifier: string,
  poi: { id: number; name: string; kind: PoiKind },
): { namespace: PoiFavNamespace; key: string } {
  return {
    namespace: FAV_NAMESPACE_BY_KIND[poi.kind],
    key: `${parkIdentifier}:${poi.kind === "show" ? poi.name : poi.id}`,
  };
}

// Plafond de parcs favoris : au-delà, la page d'accueil devient vite trop
// chargée. Appliqué CÔTÉ SERVEUR (PATCH /api/user/favorites) ; le client s'en
// sert seulement pour afficher le compteur « x/20 ».
export const PARK_FAVORITES_LIMIT = 20;
export const FAV_LIMITS: Partial<Record<string, number>> = {
  parks: PARK_FAVORITES_LIMIT,
};

/** Une liste vide par namespace. Littérale : un namespace ajouté sans elle ne
 *  compile pas. */
export function emptyFavoritesPayload(): FavoritesPayload {
  return {
    parks: [],
    rides: [],
    shows: [],
    restaurants: [],
    shops: [],
    hotels: [],
    services: [],
  };
}

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
  const payload = emptyFavoritesPayload();
  for (const namespace of FAV_NAMESPACES) {
    payload[namespace] = readNamespace(namespace);
  }
  return payload;
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
