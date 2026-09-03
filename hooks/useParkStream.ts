"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Écoute le flux « du nouveau pour ce parc » et déclenche un rafraîchissement
 * dès que le worker a écrit.
 *
 * ⚠️ **Ça ne remplace pas `useAutoRefresh`, ça le devance.** Le flux appelle le
 * MÊME `handleRefresh` que le décompte, qui replanifie ensuite son échéance
 * comme d'habitude. En marche normale le décompte n'atteint donc jamais zéro :
 * la sonnette arrive avant. Et quand le flux tombe — ce qui est le cas NORMAL
 * sur le réseau d'un parc, pas l'exception —, le décompte reprend son travail
 * sans que rien n'ait à le savoir.
 *
 * ⚠️ **Rien ne tourne quand l'onglet est caché.** Même raison que pour le
 * décompte : le produit s'utilise téléphone en poche, et une connexion ouverte
 * qu'on maintient à coups de battements coûte précisément la batterie qu'on
 * avait pris soin d'économiser. On ferme, et on rouvre au retour.
 *
 * ⚠️ `EventSource` ne réessaie PAS sur une réponse d'erreur (403, 404) : la
 * connexion est abandonnée pour de bon. C'est le comportement voulu — inutile
 * de marteler une route qui nous refuse.
 */

/** Étalement à la réception du signal. Tous les visiteurs d'un parc sont
 *  prévenus dans la même milliseconde ; sans ce délai, ils repartiraient tous
 *  chercher les données en même temps — la rafale qu'on a passé du temps à
 *  supprimer côté décompte. */
const SPREAD_MS = 2_000;

export function useParkStream(
  parkIdentifier: string,
  /** Horodatage de la donnée déjà en main, pour rattraper une écriture tombée
   *  entre le rendu de la page et l'ouverture du flux. */
  lastUpdate: string | null,
  onUpdate: () => void,
): boolean {
  const [live, setLive] = useState(false);

  // Refs : l'effet ne doit se relancer que si l'on change de parc. Ni un
  // nouveau rendu, ni une donnée fraîche ne doivent rouvrir la connexion.
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const lastUpdateRef = useRef(lastUpdate);
  lastUpdateRef.current = lastUpdate;

  useEffect(() => {
    if (typeof EventSource === "undefined") return;

    let source: EventSource | null = null;
    let spread: ReturnType<typeof setTimeout> | null = null;

    const open = () => {
      if (source) return;
      const since = lastUpdateRef.current;
      const url =
        `/api/park/${encodeURIComponent(parkIdentifier)}/stream` +
        (since ? `?since=${encodeURIComponent(since)}` : "");

      source = new EventSource(url);
      source.addEventListener("ready", () => setLive(true));
      source.addEventListener("update", () => {
        if (spread) clearTimeout(spread);
        spread = setTimeout(() => onUpdateRef.current(), Math.random() * SPREAD_MS);
      });
      source.onerror = () => {
        // Coupure passagère : `EventSource` se reconnecte seul et `ready`
        // repassera. Erreur définitive : il abandonne, et le décompte reste.
        setLive(false);
      };
    };

    const close = () => {
      if (spread) {
        clearTimeout(spread);
        spread = null;
      }
      source?.close();
      source = null;
      setLive(false);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") open();
      else close();
    };

    if (document.visibilityState === "visible") open();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      close();
    };
  }, [parkIdentifier]);

  return live;
}
