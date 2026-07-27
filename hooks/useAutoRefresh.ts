import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Décompte + rafraîchissement automatique des données d'un parc.
 *
 * Points importants :
 * - **Un seul intervalle** (1 s) qui sert à la fois de décompte affiché et de
 *   déclencheur : inutile d'en faire tourner un second juste pour tester
 *   l'échéance.
 * - **Rien ne tourne quand l'onglet est caché.** C'est le cas d'usage principal
 *   du produit (téléphone en poche dans un parc) : laisser un `setInterval`
 *   battre à la seconde y consomme de la batterie pour un écran que personne ne
 *   regarde. Au retour, si les données ont dépassé leur durée de vie, on
 *   rafraîchit immédiatement puis on repart.
 */
export function useAutoRefresh(
  lastUpdate: string,
  onRefresh?: () => Promise<void>,
  refreshInterval: number = 60000,
) {
  const [timeSinceLastUpdate, setTimeSinceLastUpdate] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);

  // Refs plutôt que dépendances : l'effet de planification ne doit pas se
  // relancer à chaque rendu, sinon l'intervalle serait recréé en boucle.
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const handleRefresh = useCallback(async () => {
    const refresh = onRefreshRef.current;
    if (!refresh || refreshingRef.current) return;

    refreshingRef.current = true;
    setIsRefreshing(true);
    try {
      await refresh();
      setJustUpdated(true);
      setTimeout(() => setJustUpdated(false), 1000);
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      refreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const remainingSeconds = () => {
      const target = new Date(lastUpdate).getTime() + refreshInterval;
      return Math.ceil((target - Date.now()) / 1000);
    };

    let timer: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const tick = () => {
      const remaining = remainingSeconds();
      setTimeSinceLastUpdate(remaining);
      // Fenêtre bornée : au-delà de 20 s de retard, les données sont considérées
      // périmées et l'UI affiche l'horodatage plutôt que de boucler sur des
      // tentatives (ex. après une longue coupure réseau).
      if (remaining <= 0 && remaining > -20) {
        handleRefresh();
      }
    };

    const start = () => {
      stop();
      tick();
      timer = setInterval(tick, 1000);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        // Onglet repris : si les données ont dépassé leur durée de vie pendant
        // l'absence, on rafraîchit tout de suite au lieu de laisser des temps
        // d'attente périmés à l'écran en attendant le prochain cycle.
        if (Date.now() - new Date(lastUpdate).getTime() > refreshInterval) {
          handleRefresh();
        }
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [lastUpdate, refreshInterval, handleRefresh]);

  return { timeSinceLastUpdate, isRefreshing, justUpdated, handleRefresh };
}
