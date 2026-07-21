import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FAV_LIMITS,
  FAV_STORAGE_PREFIX,
  FAV_SYNC_EVENT,
  readFavorites,
  writeFavorites,
} from "@/lib/favorites-storage";
import { useUser } from "@/components/providers/user-provider";
import { useAuthGate } from "@/components/providers/auth-gate-provider";

const EMPTY_FAVORITES: Set<string> = new Set();

/**
 * Favoris persistés dans localStorage. Reste la source de travail côté client,
 * y compris connecté : le UserProvider se charge de miroiter localStorage <->
 * compte (fusion à la connexion, push à chaque changement). Ce hook n'a donc pas
 * à connaître l'état d'authentification.
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
export function useFavorites(namespace: string) {
  // Les favoris nécessitent un compte : sans session, on n'expose AUCUN favori
  // (pas d'étoile pleine ni d'épinglage) et toute tentative d'ajout ouvre le
  // modal de connexion via le garde d'authentification.
  const { isAuthenticated } = useUser();
  const { requireAuth } = useAuthGate();

  const [favorites, setFavoritesState] = useState<Set<string>>(new Set());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setFavoritesState(readFavorites(namespace));
    setIsReady(true);

    const handleSync = (event: Event) => {
      if (event instanceof CustomEvent && event.detail !== namespace) return;
      if (event instanceof StorageEvent && event.key !== null) {
        if (event.key !== FAV_STORAGE_PREFIX + namespace) return;
      }
      setFavoritesState(readFavorites(namespace));
    };

    window.addEventListener("storage", handleSync);
    window.addEventListener(FAV_SYNC_EVENT, handleSync);
    return () => {
      window.removeEventListener("storage", handleSync);
      window.removeEventListener(FAV_SYNC_EVENT, handleSync);
    };
  }, [namespace]);

  const persist = useCallback(
    (next: Set<string>) => {
      setFavoritesState(next);
      writeFavorites(namespace, next);
    },
    [namespace],
  );

  // Favoris exposés : vides tant que l'utilisateur n'est pas connecté (aucun
  // favori sans compte). En interne, `favorites` reste hydraté depuis localStorage
  // (source de travail une fois connecté, miroir du compte).
  const exposedFavorites = isAuthenticated ? favorites : EMPTY_FAVORITES;

  // Renvoie true si le changement a été appliqué, false s'il a été refusé (non
  // connecté → modal de connexion, OU ajout au-delà du plafond du namespace) :
  // l'appelant peut alors prévenir l'utilisateur. Le RETRAIT n'est jamais bloqué.
  const toggle = useCallback(
    (id: string): boolean => {
      // Sans compte : on n'écrit rien, on invite à se connecter.
      if (!requireAuth()) return false;

      const next = new Set(favorites);
      if (next.has(id)) {
        next.delete(id);
      } else {
        const limit = FAV_LIMITS[namespace];
        if (limit !== undefined && next.size >= limit) return false;
        next.add(id);
      }
      persist(next);
      return true;
    },
    [favorites, persist, namespace, requireAuth],
  );

  const isFavorite = useCallback(
    (id: string) => exposedFavorites.has(id),
    [exposedFavorites],
  );

  const value = useMemo(
    () => ({
      favorites: exposedFavorites,
      isFavorite,
      toggle,
      isReady,
      setFavorites: persist,
    }),
    [exposedFavorites, isFavorite, toggle, isReady, persist],
  );

  return value;
}
