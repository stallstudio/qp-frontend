"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import type { RideHistoryResponse } from "@/types/rideHistory";

// Historique du jour + prévision d'une attraction, rafraîchis toutes les 60 s.
//
// Extrait du popup « détail attraction » pour être partagé avec la page dédiée
// (`/park/{parc}/ride/{slug}`) : les deux affichent le même graphique et ont
// besoin du même `chronicallyUnavailable` pour décider si une alerte a un sens.
//
// `rideId` à `null` (popup fermé) = aucune requête.

const REFRESH_MS = 60_000;

export function useRideHistory(parkIdentifier: string, rideId: number | null) {
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
          { signal: controller.signal },
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
  }, [rideId, parkIdentifier]);

  return {
    history,
    loading,
    // Attraction indisponible en continu : ni graphique ni alerte n'ont de sens.
    chronicallyUnavailable: history?.meta.chronicallyUnavailable ?? false,
  };
}
