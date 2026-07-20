"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import axios from "axios";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import {
  FAV_SYNC_EVENT,
  readFavorites,
  writeFavorites,
} from "@/lib/favorites-storage";
import type { UserProfile } from "@/types/user";
import type { UserPreferences } from "@/lib/user-preferences";

type Status = "loading" | "authenticated" | "unauthenticated";

interface UserContextValue {
  status: Status;
  isAuthenticated: boolean;
  profile: UserProfile | null;
  // Re-charge le profil (préférences + favoris + compteurs). À appeler après une
  // mutation d'alertes pour rafraîchir les compteurs.
  refresh: () => Promise<void>;
  // Met à jour des préférences : applique immédiatement à l'UI (thème/format/
  // langue) puis persiste dans le compte.
  updatePreferences: (patch: Partial<UserPreferences>) => Promise<void>;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

const currentFavorites = () => ({
  parks: [...readFavorites("parks")],
  rides: [...readFavorites("rides")],
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const { theme, setTheme } = useTheme();
  const { timeFormat, setFormat } = useTimeFormat();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Empêche de rejouer la réconciliation à chaque render : une fois par session.
  const syncedUserRef = useRef<string | null>(null);
  // Fenêtre pendant laquelle les écritures de favoris viennent de la synchro
  // (miroir compte -> local) et ne doivent PAS être repoussées vers le compte.
  const mirroringUntilRef = useRef(0);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Idem pour les préférences : après l'application des prefs du compte, le
  // temps que thème/locale se propagent (next-themes est asynchrone), on ne
  // repousse pas de diff transitoire vers le compte.
  const prefsMirroringUntilRef = useRef(0);

  // Applique des préférences de compte à l'UI locale (thème / format / langue).
  const applyPreferences = useCallback(
    (prefs: UserPreferences) => {
      setTheme(prefs.theme);
      setFormat(prefs.timeFormat);
      if (prefs.locale !== locale) {
        router.replace(pathname, { locale: prefs.locale });
      }
    },
    [setTheme, setFormat, locale, router, pathname],
  );

  const refresh = useCallback(async () => {
    try {
      const { data } = await axios.get<UserProfile>("/api/user/me");
      setProfile(data);
    } catch {
      // silencieux : l'absence de profil laisse l'app en mode non connecté.
    }
  }, []);

  // Réconciliation à la connexion : fusion des favoris + application/adoption des
  // préférences, une seule fois par utilisateur.
  useEffect(() => {
    if (status !== "authenticated") {
      if (status === "unauthenticated") {
        syncedUserRef.current = null;
        setProfile(null);
      }
      return;
    }

    let cancelled = false;

    (async () => {
      // 1. Fusion des favoris locaux avec le compte (union, rien n'est perdu).
      const local = currentFavorites();
      try {
        const { data: merged } = await axios.post<{
          parks: string[];
          rides: string[];
        }>("/api/user/favorites/merge", local);
        mirroringUntilRef.current = Date.now() + 1500;
        writeFavorites("parks", new Set(merged.parks));
        writeFavorites("rides", new Set(merged.rides));
      } catch {
        // on continue même si la fusion échoue : le compte reste utilisable.
      }

      // 2. Chargement du profil (préférences + compteurs à jour post-fusion).
      let loaded: UserProfile | null = null;
      try {
        const { data } = await axios.get<UserProfile>("/api/user/me");
        loaded = data;
      } catch {
        return;
      }
      if (cancelled || !loaded) return;
      setProfile(loaded);

      // Réconciliation des préférences une seule fois par session.
      if (syncedUserRef.current !== loaded.id) {
        syncedUserRef.current = loaded.id;
        // Laisse le temps aux prefs appliquées de se propager avant d'observer.
        prefsMirroringUntilRef.current = Date.now() + 2000;

        if (loaded.preferencesInitialized) {
          // Compte prime : ses préférences s'appliquent (sync multi-appareils).
          applyPreferences(loaded.preferences);
        } else {
          // Compte vierge : on y pousse les réglages locaux actuels sans rien
          // changer visuellement pour l'utilisateur.
          const localPrefs: UserPreferences = {
            locale,
            theme: (theme as UserPreferences["theme"]) ?? "system",
            timeFormat,
          };
          try {
            await axios.patch("/api/user/preferences", localPrefs);
            setProfile((prev) =>
              prev
                ? { ...prev, preferences: localPrefs, preferencesInitialized: true }
                : prev,
            );
          } catch {
            // ignoré : réessayé au prochain login.
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // On ne dépend que de `status` : la réconciliation ne doit se déclencher qu'au
    // changement d'état d'authentification, pas à chaque changement de thème/locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Synchro continue : tout (dé)favori local est repoussé vers le compte (PUT
  // complet, debouncé). Ignoré pendant la fenêtre de miroir (post-fusion).
  useEffect(() => {
    if (status !== "authenticated") return;

    const schedulePush = () => {
      if (Date.now() < mirroringUntilRef.current) return;
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      pushTimerRef.current = setTimeout(() => {
        axios
          .put("/api/user/favorites", currentFavorites())
          .then(() => refresh())
          .catch(() => {});
      }, 800);
    };

    window.addEventListener(FAV_SYNC_EVENT, schedulePush);
    window.addEventListener("storage", schedulePush);
    return () => {
      window.removeEventListener(FAV_SYNC_EVENT, schedulePush);
      window.removeEventListener("storage", schedulePush);
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, [status, refresh]);

  // Persiste un patch de préférences (compte + état local du profil), SANS le
  // réappliquer à l'UI : utilisé quand le changement vient déjà de l'UI.
  const persistPreferences = useCallback((patch: Partial<UserPreferences>) => {
    setProfile((prev) =>
      prev ? { ...prev, preferences: { ...prev.preferences, ...patch } } : prev,
    );
    axios.patch("/api/user/preferences", patch).catch(() => {
      // échec réseau : le prochain refresh() resynchronisera.
    });
  }, []);

  const updatePreferences = useCallback(
    async (patch: Partial<UserPreferences>) => {
      // Application optimiste à l'UI locale, puis persistance.
      if (patch.theme !== undefined) setTheme(patch.theme);
      if (patch.timeFormat !== undefined) setFormat(patch.timeFormat);
      if (patch.locale !== undefined && patch.locale !== locale) {
        router.replace(pathname, { locale: patch.locale });
      }
      persistPreferences(patch);
    },
    [setTheme, setFormat, locale, router, pathname, persistPreferences],
  );

  // Synchro descendante des préférences : tout changement local (sélecteur de
  // langue global, toggles du footer, page profil) est reflété dans le compte,
  // sans coupler ces composants à l'auth. Ne persiste que les écarts réels, et
  // seulement après la réconciliation initiale (évite tout aller-retour au login).
  useEffect(() => {
    if (status !== "authenticated" || !profile) return;
    if (syncedUserRef.current !== profile.id) return;
    if (Date.now() < prefsMirroringUntilRef.current) return;

    const current: UserPreferences = {
      locale,
      theme: (theme as UserPreferences["theme"]) ?? "system",
      timeFormat,
    };
    const saved = profile.preferences;
    const diff: Partial<UserPreferences> = {};
    if (current.locale !== saved.locale) diff.locale = current.locale;
    if (current.theme !== saved.theme) diff.theme = current.theme;
    if (current.timeFormat !== saved.timeFormat)
      diff.timeFormat = current.timeFormat;

    if (Object.keys(diff).length > 0) {
      persistPreferences(diff);
    }
  }, [status, profile, locale, theme, timeFormat, persistPreferences]);

  return (
    <UserContext.Provider
      value={{
        status: status as Status,
        isAuthenticated: status === "authenticated",
        profile,
        refresh,
        updatePreferences,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
