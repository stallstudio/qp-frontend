import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Décompte + rafraîchissement automatique des données d'un parc.
 *
 * ————————————————————————————————————————————————————————————————————————
 * **C'EST LE SERVEUR QUI DIT QUAND REVENIR.** Ce hook ne calcule plus de
 * cadence, il obéit à celle qu'on lui annonce (`ParkLiveData.nextUpdateIn`,
 * mesurée sur les passages réels du worker — voir `lib/collection-cycle.ts`).
 * ————————————————————————————————————————————————————————————————————————
 *
 * Deux versions ont échoué avant, l'une comme l'autre parce qu'elles
 * DEVINAIENT ici une cadence que le client ne peut pas connaître :
 *
 * - **`lastUpdate + 60 s`** — l'horodatage de la donnée. Le worker ne l'écrit
 *   que si son fetch réussit : dès qu'une source tombait, il se figeait, le
 *   décompte plongeait dans le négatif, sortait de la fenêtre de déclenchement
 *   et plus RIEN ne se rafraîchissait, y compris au retour d'onglet. L'écran
 *   restait bloqué sur « Dernière mise à jour ».
 * - **`Date.now() + 60 s`** — l'horloge du client, qui a corrigé ce blocage
 *   mais en a créé un autre, plus discret : le décompte n'avait plus aucun
 *   rapport avec la base. Un rechargement de page repartait de soixante, et le
 *   fetch tombait à un instant arbitraire du cycle — souvent juste avant
 *   l'écriture qu'il attendait.
 *
 * Aucune des deux ne pouvait tomber juste, et la mesure dit pourquoi : le
 * worker écrit bien à chaque minute, mais à un instant qui se promène —
 * minute ronde + 30 s en médiane, avec ±15 s de dispersion. Deux choses
 * échappent au navigateur : où il en est dans cette grille, et QUELLE minute de
 * collecte il tient déjà en main. Le serveur, lui, sait les deux — alors il
 * calcule le délai et le dit.
 *
 * Ce qui est conservé de la version précédente, et pourquoi :
 *
 * - **Le cycle ne peut jamais s'arrêter.** Une échéance est reposée dans le
 *   `finally` de CHAQUE tentative, succès comme échec, et toute valeur venue du
 *   serveur est bornée avant usage. Sans réponse exploitable, on retombe sur
 *   une minute — c'est-à-dire sur l'ancien comportement, jamais sur l'arrêt.
 * - **Un seul intervalle** (1 s), à la fois décompte affiché et déclencheur.
 * - **Rien ne tourne quand l'onglet est caché.** C'est le cas d'usage principal
 *   du produit (téléphone en poche dans un parc) : laisser un `setInterval`
 *   battre à la seconde y consomme de la batterie pour un écran que personne ne
 *   regarde. Au retour, si l'échéance est passée pendant l'absence, on
 *   rafraîchit immédiatement puis on repart.
 */

/** Cadence de repli : le serveur n'a rien annoncé d'exploitable. C'est
 *  exactement ce que faisait le code d'avant, en dur. */
const FALLBACK_SECONDS = 60;

/** Garde-fous sur ce que le serveur annonce. Ils ne servent qu'au cas où une
 *  version d'API renverrait `0`, du texte ou un négatif : le client ne doit
 *  jamais pouvoir être transformé en marteau par une réponse malformée. */
const MIN_SECONDS = 5;
const MAX_SECONDS = 300;

/** Plafond du recul après échecs répétés. Assez haut pour ne pas entretenir une
 *  panne de serveur à coups de sondages, assez bas pour qu'un réseau revenu ne
 *  laisse pas l'écran figé plus de deux minutes. */
const MAX_BACKOFF_SECONDS = 120;

function clampSeconds(value: number): number {
  if (!Number.isFinite(value)) return FALLBACK_SECONDS;
  return Math.min(Math.max(value, MIN_SECONDS), MAX_SECONDS);
}

export function useAutoRefresh(
  /**
   * Recharge les données et rend le `nextUpdateIn` que le serveur vient
   * d'annoncer.
   *
   * ⚠️ **La valeur est RENDUE, pas lue dans les props au rendu suivant.** Le
   * `finally` s'exécute avant que React ait re-rendu avec les données fraîches :
   * aller chercher l'échéance dans une prop y donnerait celle du cycle
   * PRÉCÉDENT, et le décalage s'accumulerait à chaque tour.
   */
  onRefresh?: () => Promise<number | null | undefined>,
  /** Échéance du premier cycle, telle que servie avec les données initiales
   *  (rendu serveur). C'est elle qui fait qu'un rechargement de page ne remet
   *  pas le décompte à soixante mais le reprend là où le cycle en est. */
  initialDelaySeconds?: number,
) {
  const firstDelay = clampSeconds(initialDelaySeconds ?? FALLBACK_SECONDS);

  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(firstDelay);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refs plutôt que dépendances : l'effet de planification ne doit pas se
  // relancer à chaque rendu, sinon l'intervalle serait recréé en boucle.
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  // Échecs consécutifs, pour le recul progressif. Remis à zéro dès qu'une
  // tentative aboutit.
  const failuresRef = useRef(0);

  // Échéance du prochain rafraîchissement. En ref (et non en state) : le tick
  // la lit chaque seconde, elle ne doit pas re-planifier l'effet en changeant.
  const nextRefreshAt = useRef(Date.now() + firstDelay * 1000);

  const handleRefresh = useCallback(async () => {
    const refresh = onRefreshRef.current;
    if (!refresh || refreshingRef.current) return;

    refreshingRef.current = true;
    setIsRefreshing(true);

    let nextDelay = FALLBACK_SECONDS;
    try {
      const announced = await refresh();
      failuresRef.current = 0;
      nextDelay = clampSeconds(announced ?? FALLBACK_SECONDS);
    } catch (error) {
      console.error("Refresh failed:", error);
      failuresRef.current += 1;
      // Recul progressif : réessayer à la même cadence pendant une panne
      // ajoute du trafic exactement quand le serveur en a le moins besoin.
      nextDelay = Math.min(
        FALLBACK_SECONDS * 2 ** (failuresRef.current - 1),
        MAX_BACKOFF_SECONDS,
      );
    } finally {
      // Reposée dans TOUS les cas : c'est ce qui rend l'arrêt définitif du
      // cycle impossible, quoi que raconte le serveur ou le réseau.
      nextRefreshAt.current = Date.now() + nextDelay * 1000;
      refreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, []);

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
      setSecondsUntilRefresh(Math.max(0, remaining));
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
  }, [handleRefresh]);

  return { secondsUntilRefresh, isRefreshing, handleRefresh };
}
