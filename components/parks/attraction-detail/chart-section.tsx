"use client";

import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import WaitTimeChart from "@/components/parks/wait-time-chart";
import type { RideHistoryResponse } from "@/types/rideHistory";

type ChartSectionProps = {
  // Historique + prévision, récupérés et rafraîchis par le popup parent (partagé
  // avec la section Alertes qui a besoin du statut d'indisponibilité).
  data: RideHistoryResponse | null;
  loading: boolean;
};

// Pastille de couleur du badge de fiabilité de la prévision.
const RELIABILITY_COLOR: Record<string, string> = {
  low: "bg-red-500",
  medium: "bg-amber-500",
  high: "bg-emerald-500",
};

// Rend le graphique du jour + prévision. États : chargement / indisponible /
// pas de données / graphique.
export default function ChartSection({ data, loading }: ChartSectionProps) {
  const t = useTranslations("attractionDetail");

  // Hauteur réservée (≈ graphique 180px + légende + note) : identique pour tous
  // les états afin que la taille du popup ne « saute » pas.
  if (loading && !data) {
    return (
      <div className="flex h-[226px] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasActual = !!data && data.today.some((p) => p.waitTime != null);
  const hasForecast = !!data && data.forecast.length > 0;

  if (!data || (!hasActual && !hasForecast)) {
    // Message adapté : indisponibilité durable > indisponibilité du jour > pas
    // encore de données. Une attraction fermée toute la journée (ou en continu)
    // ne doit pas afficher « pas encore de données ».
    const message = data?.meta.chronicallyUnavailable
      ? t("chartUnavailablePermanent")
      : data && data.today.length > 0
        ? t("chartUnavailable")
        : t("chartEmpty");
    return (
      <div className="flex h-[226px] items-center justify-center text-center text-sm text-muted-foreground">
        {message}
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
