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
import { useTemperatureUnit } from "@/hooks/useTemperatureUnit";
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

// Utilisateurs dont les préférences ont DÉJÀ été réconciliées durant ce
// chargement de page. Volontairement AU NIVEAU MODULE (pas un ref) : un
// changement de langue remonte le sous-arbre `[locale]` (donc ce provider), ce
// qui réinitialiserait un ref et RE-jouerait la réconciliation — laquelle
// réappliquerait la locale du COMPTE (souvent encore périmée, la persistance du
// nouveau choix n'ayant pas fini), renvoyant l'utilisateur à sa langue
// précédente (le fameux « je passe en EN puis ça repasse en FR »). Un ensemble
// de module survit à ces remontages et ne se vide qu'au vrai rechargement de
// page (ou à la déconnexion), garantissant UNE réconciliation par session.
const reconciledUsers = new Set<string>();

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const { theme, setTheme } = useTheme();
  const { timeFormat, setFormat } = useTimeFormat();
  const { temperatureUnit, setUnit } = useTemperatureUnit();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Après l'application des préférences du compte, le temps que thème/locale se
  // propagent (next-themes est asynchrone), on ne repousse pas vers le compte un
  // écart purement transitoire.
  const prefsMirroringUntilRef = useRef(0);

  // Applique des préférences de compte à l'UI locale (thème / format / langue).
  const applyPreferences = useCallback(
    (prefs: UserPreferences) => {
      setTheme(prefs.theme);
      setFormat(prefs.timeFormat);
      setUnit(prefs.temperatureUnit);
      if (prefs.locale !== locale) {
        router.replace(pathname, { locale: prefs.locale });
      }
    },
    [setTheme, setFormat, setUnit, locale, router, pathname],
  );

  const refresh = useCallback(async () => {
    try {
      const { data } = await axios.get<UserProfile>("/api/user/me");
      setProfile(data);
    } catch {
      // silencieux : l'absence de profil laisse l'app en mode non connecté.
    }
  }, []);

  // Réconciliation des préférences à la connexion, une seule fois par
  // utilisateur. Les favoris ne passent PLUS par ici : ils appartiennent au
  // `FavoritesProvider`, qui les lit directement depuis le compte.
  useEffect(() => {
    if (status !== "authenticated") {
      if (status === "unauthenticated") {
        reconciledUsers.clear();
        setProfile(null);
      }
      return;
    }

    let cancelled = false;

    (async () => {
      // Chargement du profil (préférences + compteurs).
      let loaded: UserProfile | null = null;
      try {
        const { data } = await axios.get<UserProfile>("/api/user/me");
        loaded = data;
      } catch {
        return;
      }
      if (cancelled || !loaded) return;
      setProfile(loaded);

      // Réconciliation des préférences une seule fois par session (guard de
      // module : survit au remontage provoqué par un changement de langue).
      if (!reconciledUsers.has(loaded.id)) {
        reconciledUsers.add(loaded.id);
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
            temperatureUnit,
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
      if (patch.temperatureUnit !== undefined) setUnit(patch.temperatureUnit);
      if (patch.locale !== undefined && patch.locale !== locale) {
        router.replace(pathname, { locale: patch.locale });
      }
      persistPreferences(patch);
    },
    [setTheme, setFormat, setUnit, locale, router, pathname, persistPreferences],
  );

  // Synchro descendante des préférences : tout changement local (sélecteur de
  // langue global, toggles du footer, page profil) est reflété dans le compte,
  // sans coupler ces composants à l'auth. Ne persiste que les écarts réels, et
  // seulement après la réconciliation initiale (évite tout aller-retour au login).
  useEffect(() => {
    if (status !== "authenticated" || !profile) return;
    if (!reconciledUsers.has(profile.id)) return;
    if (Date.now() < prefsMirroringUntilRef.current) return;

    const current: UserPreferences = {
      locale,
      theme: (theme as UserPreferences["theme"]) ?? "system",
      timeFormat,
      temperatureUnit,
    };
    const saved = profile.preferences;
    const diff: Partial<UserPreferences> = {};
    if (current.locale !== saved.locale) diff.locale = current.locale;
    if (current.theme !== saved.theme) diff.theme = current.theme;
    if (current.timeFormat !== saved.timeFormat)
      diff.timeFormat = current.timeFormat;
    if (current.temperatureUnit !== saved.temperatureUnit)
      diff.temperatureUnit = current.temperatureUnit;

    if (Object.keys(diff).length > 0) {
      persistPreferences(diff);
    }
  }, [
    status,
    profile,
    locale,
    theme,
    timeFormat,
    temperatureUnit,
    persistPreferences,
  ]);

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
