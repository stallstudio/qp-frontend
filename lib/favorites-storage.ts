// Primitives de stockage des favoris dans localStorage, partagées par le hook
// useFavorites (source de travail côté client) et le UserProvider (synchro avec
// le compte). Centralisées ici pour que les deux ne divergent jamais.
//
// Namespaces : "parks" (key = park.identifier), "rides" (key = "{parkIdentifier}:{rideId}")
// et "shows" (key = "{parkIdentifier}:{showName}").

export const FAV_STORAGE_PREFIX = "qp:fav:";
export const FAV_SYNC_EVENT = "qp-fav-change";
export const FAV_NAMESPACES = ["parks", "rides", "shows"] as const;
export type FavNamespace = (typeof FAV_NAMESPACES)[number];

// Plafond de parcs favoris : au-delà, la page d'accueil devient vite trop chargée.
// Appliqué à l'AJOUT interactif (voir useFavorites.toggle) ; la synchro descendante
// depuis le compte (fusion) n'est pas tronquée pour ne rien perdre silencieusement.
export const PARK_FAVORITES_LIMIT = 20;
export const FAV_LIMITS: Partial<Record<string, number>> = {
  parks: PARK_FAVORITES_LIMIT,
};

export function readFavorites(namespace: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(FAV_STORAGE_PREFIX + namespace);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

// Écrit un namespace et notifie les instances (même onglet) via l'événement custom.
export function writeFavorites(namespace: string, values: Set<string>): void {
  try {
    window.localStorage.setItem(
      FAV_STORAGE_PREFIX + namespace,
      JSON.stringify([...values]),
    );
    window.dispatchEvent(new CustomEvent(FAV_SYNC_EVENT, { detail: namespace }));
  } catch {
    // localStorage indisponible (mode privé, quota) : état gardé en mémoire ailleurs.
  }
}
