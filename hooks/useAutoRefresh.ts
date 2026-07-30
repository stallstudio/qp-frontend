import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Décompte + rafraîchissement automatique des données d'un parc.
 *
 * Points importants :
 * - **Le décompte part du DERNIER FETCH CLIENT**, pas de l'horodatage des
 *   données. ⚠️ C'était le bug : le hook décomptait depuis `park.lastUpdate`,
 *   c'est-à-dire `parks.lastUpdatedAt`, que le worker n'écrit **que si son fetch
 *   réussit**. Dès qu'une source tombait (ou la nuit, ou si la Schedule Dokploy
 *   patinait), cet horodatage se figeait : le décompte plongeait dans le négatif,
 *   sortait de la fenêtre de déclenchement et plus RIEN ne se rafraîchissait —
 *   y compris au retour d'onglet, puisque rafraîchir ne changeait pas la valeur
 *   qui servait de référence. L'écran restait bloqué sur « Dernière mise à
 *   jour ». Ici `fetchedAt` avance à chaque tentative, donc le cycle repart
 *   toujours, quoi que raconte la base.
 * - **Un seul intervalle** (1 s) qui sert à la fois de décompte affiché et de
 *   déclencheur : inutile d'en faire tourner un second juste pour tester
 *   l'échéance.
 * - **Rien ne tourne quand l'onglet est caché.** C'est le cas d'usage principal
 *   du produit (téléphone en poche dans un parc) : laisser un `setInterval`
 *   battre à la seconde y consomme de la batterie pour un écran que personne ne
 *   regarde. Au retour, si l'échéance est passée pendant l'absence, on
 *   rafraîchit immédiatement puis on repart.
 */
export function useAutoRefresh(
  onRefresh?: () => Promise<void>,
  refreshInterval: number = 60000,
) {
  const [timeSinceLastUpdate, setTimeSinceLastUpdate] = useState(
    Math.ceil(refreshInterval / 1000),
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);

  // Refs plutôt que dépendances : l'effet de planification ne doit pas se
  // relancer à chaque rendu, sinon l'intervalle serait recréé en boucle.
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  // Échéance du prochain rafraîchissement. En ref (et non en state) : le tick
  // la lit chaque seconde, elle ne doit pas re-planifier l'effet en changeant.
  // Au montage, les données viennent d'arriver (rendu serveur ou premier fetch),
  // donc l'échéance est à un intervalle complet.
  const nextRefreshAt = useRef(Date.now() + refreshInterval);

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
      // Replanifiée dans TOUS les cas, succès comme échec : en cas d'échec on
      // réessaie au cycle suivant plutôt que de marteler l'API — et surtout le
      // cycle ne peut jamais s'arrêter définitivement.
      nextRefreshAt.current = Date.now() + refreshInterval;
      refreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [refreshInterval]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const tick = () => {
      const remaining = Math.ceil((nextRefreshAt.current - Date.now()) / 1000);
      setTimeSinceLastUpdate(Math.max(0, remaining));
      if (remaining <= 0) handleRefresh();
    };

    const start = () => {
      stop();
      tick();
      timer = setInterval(tick, 1000);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        // Onglet repris : si l'échéance est passée pendant l'absence, on
        // rafraîchit tout de suite au lieu de laisser des temps d'attente
        // périmés à l'écran en attendant le prochain cycle.
        if (Date.now() >= nextRefreshAt.current) handleRefresh();
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
  }, [refreshInterval, handleRefresh]);

  return { timeSinceLastUpdate, isRefreshing, justUpdated, handleRefresh };
}
