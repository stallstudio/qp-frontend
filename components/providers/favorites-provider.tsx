"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import { useSession } from "next-auth/react";
import {
  FAV_NAMESPACES,
  FAV_STORAGE_PREFIX,
  clearFavoritesCache,
  readFavoritesCache,
  writeFavoritesCache,
  type FavNamespace,
} from "@/lib/favorites-storage";
import type { FavoritesPayload } from "@/types/user";

/**
 * Source de vérité des favoris.
 *
 * Le COMPTE fait autorité — les favoris exigent une session, il n'existe donc
 * aucun état « favoris hors ligne » à réconcilier. `localStorage` n'est plus
 * qu'un CACHE d'affichage : il évite que les étoiles clignotent (vides puis
 * pleines) le temps que la session et le profil se chargent.
 *
 * Historiquement, localStorage était la source de travail et le UserProvider
 * miroitait dans les deux sens, à coups de fenêtres temporelles
 * (`mirroringUntil…`) pour distinguer « l'utilisateur a cliqué » de « la synchro
 * vient d'écrire ». Chacune de ces fenêtres corrigeait un vrai bug, mais le
 * modèle rendait ces bugs possibles. Ici, une mutation est un appel ciblé dont
 * on applique la réponse : plus de course, plus de délais à régler.
 */

type FavoritesState = Record<FavNamespace, Set<string>>;

interface FavoritesContextValue {
  favorites: FavoritesState;
  // false tant que l'état affiché vient du seul cache (session en cours de
  // chargement) : les composants peuvent éviter d'animer un état provisoire.
  isReady: boolean;
  // Renvoie true si le changement a été appliqué. false = refusé (plafond
  // atteint côté serveur) ; l'appelant prévient alors l'utilisateur.
  setFavorite: (
    namespace: FavNamespace,
    key: string,
    value: boolean,
  ) => Promise<boolean>;
}

const FavoritesContext = createContext<FavoritesContextValue | undefined>(
  undefined,
);

const emptyState = (): FavoritesState => ({
  parks: new Set(),
  rides: new Set(),
  shows: new Set(),
});

const payloadToState = (payload: FavoritesPayload): FavoritesState => ({
  parks: new Set(payload.parks ?? []),
  rides: new Set(payload.rides ?? []),
  shows: new Set(payload.shows ?? []),
});

const stateToPayload = (state: FavoritesState): FavoritesPayload => ({
  parks: [...state.parks],
  rides: [...state.rides],
  shows: [...state.shows],
});

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [favorites, setFavorites] = useState<FavoritesState>(emptyState);
  const [isReady, setIsReady] = useState(false);

  // Évite d'écraser un clic parti « en même temps » qu'un chargement : seule la
  // dernière écriture connue par le provider fait foi.
  const stateRef = useRef(favorites);
  stateRef.current = favorites;

  const applyState = useCallback((next: FavoritesState) => {
    setFavorites(next);
    writeFavoritesCache(stateToPayload(next));
  }, []);

  // 1. Hydratation immédiate depuis le cache. Après le montage seulement, pour
  //    que le premier rendu client soit identique au HTML serveur (état vide).
  //    C'est aussi ce qui rend l'état « affichable » : attendre la réponse du
  //    compte ferait clignoter les listes de favoris à chaque chargement.
  useEffect(() => {
    setFavorites(payloadToState(readFavoritesCache()));
    setIsReady(true);
  }, []);

  // 2. Chargement depuis le compte, qui fait autorité.
  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      // Aucun favori sans compte : on purge l'état ET le cache, sans quoi les
      // favoris d'une session précédente réapparaîtraient pour le visiteur
      // suivant sur le même navigateur.
      setFavorites(emptyState());
      clearFavoritesCache();
      return;
    }

    let cancelled = false;
    axios
      .get<FavoritesPayload>("/api/user/favorites")
      .then(({ data }) => {
        if (cancelled) return;
        applyState(payloadToState(data));
      })
      .catch(() => {
        // Échec réseau : on garde l'affichage issu du cache plutôt que de vider
        // les étoiles de l'utilisateur.
      });

    return () => {
      cancelled = true;
    };
  }, [status, applyState]);

  // 3. Synchronisation entre onglets. Le cache est écrit par chaque onglet ;
  //    l'événement `storage` ne se déclenchant que dans les AUTRES onglets, il
  //    suffit d'y recharger l'état.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && !event.key.startsWith(FAV_STORAGE_PREFIX)) {
        return;
      }
      setFavorites(payloadToState(readFavoritesCache()));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setFavorite = useCallback(
    async (namespace: FavNamespace, key: string, value: boolean) => {
      const previous = stateRef.current;
      if (previous[namespace].has(key) === value) return true;

      // Application optimiste : l'étoile réagit au clic, sans attendre le réseau.
      const optimistic: FavoritesState = {
        ...previous,
        [namespace]: new Set(previous[namespace]),
      };
      if (value) optimistic[namespace].add(key);
      else optimistic[namespace].delete(key);
      applyState(optimistic);

      try {
        const { data } = await axios.patch<FavoritesPayload>(
          "/api/user/favorites",
          { namespace, key, value },
        );
        // On applique l'état RENVOYÉ par le serveur : il intègre d'éventuelles
        // modifications faites depuis un autre appareil entre-temps.
        applyState(payloadToState(data));
        return true;
      } catch {
        // Refus (plafond) ou panne réseau : retour à l'état précédent, l'UI ne
        // doit jamais afficher un favori qui n'existe pas côté compte.
        applyState(previous);
        return false;
      }
    },
    [applyState],
  );

  const value = useMemo(
    () => ({ favorites, isReady, setFavorite }),
    [favorites, isReady, setFavorite],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavoritesContext() {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error(
      "useFavoritesContext must be used within a FavoritesProvider",
    );
  }
  return context;
}

export { FAV_NAMESPACES };
