"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import type { RideHistoryResponse } from "@/types/rideHistory";
import { STANDBY_QUEUE } from "@/lib/queue-types";

// Historique du jour + prévision d'une attraction, rafraîchis toutes les 60 s.
//
// Extrait du popup « détail attraction » pour être partagé avec la page dédiée
// (`/park/{parc}/ride/{slug}`) : les deux affichent le même graphique et ont
// besoin du même `chronicallyUnavailable` pour décider si une alerte a un sens.
//
// `rideId` à `null` (popup fermé) = aucune requête. `queueType` : la file
// tracée, `standby` par défaut (le popup d'une file Single Rider trace la
// sienne).

const REFRESH_MS = 60_000;

export function useRideHistory(
  parkIdentifier: string,
  rideId: number | null,
  queueType: string = STANDBY_QUEUE,
) {
  const [history, setHistory] = useState<RideHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (rideId == null) return;
    const controller = new AbortController();
    let cancelled = false;

    const fetchHistory = () =>
      axios
        .get<{ data: RideHistoryResponse }>(
          `/api/park/${parkIdentifier}/ride/${rideId}/history`,
          {
            signal: controller.signal,
            // Pas de paramètre pour la file standby : l'URL reste celle que
            // les caches et les journaux connaissent.
            params: queueType === STANDBY_QUEUE ? undefined : { queue: queueType },
          },
        )
        .then((res) => {
          if (!cancelled) setHistory(res.data.data);
        })
        .catch(() => {
          // Le graphique est un bonus : en cas d'échec on garde l'état courant.
        });

    setLoading(true);
    setHistory(null);
    fetchHistory().finally(() => {
      if (!cancelled) setLoading(false);
    });

    const interval = setInterval(fetchHistory, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
      controller.abort();
    };
  }, [rideId, parkIdentifier, queueType]);

  return {
    history,
    loading,
    // Attraction indisponible en continu : ni graphique ni alerte n'ont de sens.
    chronicallyUnavailable: history?.meta.chronicallyUnavailable ?? false,
  };
}
