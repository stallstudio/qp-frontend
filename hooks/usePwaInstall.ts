"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  canInstall,
  detectPlatform,
  isStandalone,
  promptInstall,
  subscribePwa,
  type PwaPlatform,
} from "@/lib/pwa";

type PwaInstallState = {
  // App lancée en mode installé (PWA standalone).
  isStandalone: boolean;
  platform: PwaPlatform;
  // Une invite d'installation native est disponible (bouton possible).
  canPrompt: boolean;
  promptInstall: typeof promptInstall;
  // false tant que la détection côté client n'a pas eu lieu : permet d'éviter
  // d'afficher l'écran « navigateur » un instant avant de savoir qu'on est en PWA.
  hydrated: boolean;
};

/**
 * État PWA : mode d'affichage (standalone vs navigateur), plateforme, et
 * disponibilité de l'invite d'installation native. `isStandalone`/`platform`
 * sont calculés après le montage (impossibles à connaître côté serveur), donc
 * l'état initial est « navigateur / desktop » puis se corrige immédiatement.
 */
export function usePwaInstall(): PwaInstallState {
  // canPrompt réagit à beforeinstallprompt / appinstalled via le store module.
  const canPrompt = useSyncExternalStore(
    subscribePwa,
    canInstall,
    () => false,
  );

  const [standalone, setStandalone] = useState(false);
  const [platform, setPlatform] = useState<PwaPlatform>("desktop");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setHydrated(true);

    const sync = () => setStandalone(isStandalone());
    sync();

    const mql = window.matchMedia("(display-mode: standalone)");
    mql.addEventListener?.("change", sync);
    // appinstalled peut basculer l'état standalone : on écoute aussi le store.
    const unsub = subscribePwa(sync);

    return () => {
      mql.removeEventListener?.("change", sync);
      unsub();
    };
  }, []);

  return { isStandalone: standalone, platform, canPrompt, promptInstall, hydrated };
}
