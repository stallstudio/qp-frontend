"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import WaitTimeChart from "@/components/parks/wait-time-chart";
import type { RideHistoryResponse } from "@/types/rideHistory";

type ChartSectionProps = {
  parkIdentifier: string;
  rideId: number;
};

// Pastille de couleur du badge de fiabilité de la prévision.
const RELIABILITY_COLOR: Record<string, string> = {
  low: "bg-red-500",
  medium: "bg-amber-500",
  high: "bg-emerald-500",
};

// Récupère l'historique du jour + prévision pour l'attraction (à la demande) et
// rend le graphique. États chargement / vide / ok.
export default function ChartSection({
  parkIdentifier,
  rideId,
}: ChartSectionProps) {
  const t = useTranslations("attractionDetail");
  const [data, setData] = useState<RideHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Rafraîchissement périodique tant que le popup est ouvert : la prévision (et
  // la courbe du jour) évoluent en direct. Le 1er appel gère le spinner ; les
  // suivants sont SILENCIEUX (on ne repasse pas `loading` à true) pour ne pas
  // faire clignoter le graphique — la nouvelle donnée est passée telle quelle,
  // le graphique anime la transition (voir wait-time-chart.tsx).
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const fetchHistory = () =>
      axios
        .get<{ data: RideHistoryResponse }>(
          `/api/park/${parkIdentifier}/ride/${rideId}/history`,
          { signal: controller.signal },
        )
        .then((res) => {
          if (!cancelled) setData(res.data.data);
        })
        .catch(() => {
          // Le graphique est un bonus : en cas d'échec on garde l'état courant.
        });

    setLoading(true);
    fetchHistory().finally(() => {
      if (!cancelled) setLoading(false);
    });

    const interval = setInterval(fetchHistory, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      controller.abort();
    };
  }, [parkIdentifier, rideId]);

  // Hauteur réservée (≈ graphique 180px + légende + note) : identique pour les
  // états chargement / vide / rendu afin que la taille du popup ne change PAS
  // entre l'ouverture (spinner) et l'affichage du graphique (pas de « saut »).
  if (loading) {
    return (
      <div className="flex h-[226px] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // On affiche le graphique dès qu'il y a soit des données observées du jour,
  // soit une prévision (cas AVANT ouverture : pas encore d'observé, mais une
  // prévision pré-ouverture est disponible -> point 1 de A FAIRE).
  const hasData =
    data && (data.today.some((p) => p.waitTime != null) || data.forecast.length > 0);
  if (!hasData) {
    return (
      <div className="flex h-[226px] items-center justify-center text-center text-sm text-muted-foreground">
        {t("chartEmpty")}
      </div>
    );
  }

  return (
    <div className="flex min-h-[226px] flex-col gap-2">
      <WaitTimeChart
        today={data.today}
        forecast={data.forecast}
        window={data.window}
        now={data.now}
        timezone={data.timezone}
        nowLabel={t("chartNow")}
        todayLabel={t("chartToday")}
        actualLabel={t("chartActual")}
        forecastLabel={t("chartForecast")}
      />
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-primary" />
          {t("chartToday")}
        </span>
        {data.forecast.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-primary/50" />
            {t("chartForecast")}
          </span>
        )}
        {data.forecast.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span
              className={`size-2 rounded-full ${
                RELIABILITY_COLOR[data.meta.confidenceLevel]
              }`}
            />
            {t("reliabilityLabel")}: {t(`reliability_${data.meta.confidenceLevel}`)}
          </span>
        )}
      </div>
      {data.forecast.length > 0 && (
        <p className="text-center text-[11px] text-muted-foreground/80">
          {data.meta.preOpening
            ? t("chartForecastPreOpeningNote")
            : t("chartForecastNote")}
        </p>
      )}
    </div>
  );
}
