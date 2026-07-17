import { useCallback, useEffect, useState } from "react";

/**
 * Favoris persistés dans localStorage, sans compte utilisateur.
 *
 * - `namespace` isole les listes (ex: "parks", "rides").
 * - SSR-safe : on démarre avec un Set vide (identique au rendu serveur) puis on
 *   hydrate depuis localStorage après le montage pour éviter tout mismatch.
 * - Synchronisé entre onglets (`storage`) et entre instances du même onglet
 *   (événement custom `qp-fav-change`).
 *
 * Important : toute la persistance passe par `persist(next)` avec une valeur
 * concrète — jamais d'effet de bord (write localStorage / dispatch) à l'intérieur
 * d'un updater `setState`, sous peine d'être exécuté deux fois en StrictMode
 * (React 19) et d'annuler le toggle.
 */
const STORAGE_PREFIX = "qp:fav:";
const SYNC_EVENT = "qp-fav-change";

function readFavorites(namespace: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + namespace);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

export function useFavorites(namespace: string) {
  const [favorites, setFavoritesState] = useState<Set<string>>(new Set());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setFavoritesState(readFavorites(namespace));
    setIsReady(true);

    const handleSync = (event: Event) => {
      if (event instanceof CustomEvent && event.detail !== namespace) return;
      if (event instanceof StorageEvent && event.key !== null) {
        if (event.key !== STORAGE_PREFIX + namespace) return;
      }
      setFavoritesState(readFavorites(namespace));
    };

    window.addEventListener("storage", handleSync);
    window.addEventListener(SYNC_EVENT, handleSync);
    return () => {
      window.removeEventListener("storage", handleSync);
      window.removeEventListener(SYNC_EVENT, handleSync);
    };
  }, [namespace]);

  const persist = useCallback(
    (next: Set<string>) => {
      setFavoritesState(next);
      try {
        window.localStorage.setItem(
          STORAGE_PREFIX + namespace,
          JSON.stringify([...next]),
        );
        window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: namespace }));
      } catch {
        // localStorage indisponible (mode privé, quota) : on garde l'état en mémoire.
      }
    },
    [namespace],
  );

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(favorites);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      persist(next);
    },
    [favorites, persist],
  );

  const isFavorite = useCallback((id: string) => favorites.has(id), [favorites]);

  return { favorites, isFavorite, toggle, isReady, setFavorites: persist };
}
