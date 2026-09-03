import { useCallback, useMemo } from "react";
import { useFavoritesContext } from "@/components/providers/favorites-provider";
import { useAuthGate } from "@/components/providers/auth-gate-provider";
import type { FavNamespace } from "@/lib/favorites-storage";

/**
 * Accès aux favoris d'un namespace ("parks", "rides", "shows").
 *
 * Simple sélecteur au-dessus du `FavoritesProvider`, qui détient l'état et
 * assure la persistance (le compte fait autorité, localStorage n'est qu'un
 * cache d'affichage). Ce hook ne lit ni n'écrit plus le stockage directement :
 * c'est ce qui garantit que tous les composants voient exactement le même état,
 * sans événement de synchronisation à écouter.
 */
export function useFavorites(namespace: FavNamespace) {
  const { favorites, isReady, setFavorite } = useFavoritesContext();
  const { requireAuth } = useAuthGate();

  const namespaceFavorites = favorites[namespace];

  const isFavorite = useCallback(
    (id: string) => namespaceFavorites.has(id),
    [namespaceFavorites],
  );

  /**
   * Bascule un favori. Renvoie `true` si le changement est appliqué, `false`
   * s'il est refusé : soit l'utilisateur n'est pas connecté (le garde ouvre
   * alors le modal de connexion), soit le serveur a rejeté l'ajout parce que le
   * plafond du namespace est atteint. L'appelant peut ainsi prévenir.
   *
   * Le RETRAIT n'est jamais bloqué par un plafond.
   */
  const toggle = useCallback(
    async (id: string): Promise<boolean> => {
      if (!requireAuth()) return false;
      return setFavorite(namespace, id, !namespaceFavorites.has(id));
    },
    [namespace, namespaceFavorites, requireAuth, setFavorite],
  );

  return useMemo(
    () => ({ favorites: namespaceFavorites, isFavorite, toggle, isReady }),
    [namespaceFavorites, isFavorite, toggle, isReady],
  );
}
