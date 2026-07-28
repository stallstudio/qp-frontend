"use client";

import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import WaitTimeChart from "@/components/parks/wait-time-chart";
import { ClickableTooltip } from "@/components/ui/clickable-tooltip";
import type { RideHistoryResponse } from "@/types/rideHistory";

type ChartSectionProps = {
  // Historique + prévision, récupérés et rafraîchis par le popup parent (partagé
  // avec la section Alertes qui a besoin du statut d'indisponibilité).
  data: RideHistoryResponse | null;
  loading: boolean;
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
  // Marge d'erreur MESURÉE (prévision de la veille confrontée à l'observé). On
  // ne l'annonce que si au moins un point de la courbe en porte une : le
  // graphique et le texte doivent dire la même chose.
  const hasMargin =
    !!data && data.forecast.some((p) => p.margin != null && p.margin > 0);
  const marginMinutes = data?.meta.marginMinutes;

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
        marginLabel={(minutes) => t("marginInline", { minutes })}
      />
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-primary" />
          {t("chartToday")}
        </span>
        {/* Pas d'échelle qualitative de « fiabilité » : l'indice calculé mesure
            le VOLUME de données disponibles, pas la justesse réelle de la
            prévision (jamais confrontée à l'observé). Annoncer « fiabilité
            haute » promettrait plus que ce qu'on sait tenir. La réserve est
            portée par « Prévision » elle-même (souligné pointillé = explication
            au survol/tact), plutôt que par une entrée de légende en plus. */}
        {data.forecast.length > 0 && (
          <ClickableTooltip
            content={t("estimateTooltip")}
            className="max-w-[15rem] text-center text-xs"
          >
            <button
              type="button"
              className="flex cursor-help items-center gap-1.5"
            >
              <span className="w-4 border-t-2 border-dashed border-primary/50" />
              <span className="underline decoration-dotted underline-offset-2">
                {t("chartForecast")}
              </span>
            </button>
          </ClickableTooltip>
        )}
        {/* Entrée de légende de la bande d'incertitude : un aplat de la même
            couleur que la prévision, pour qu'on relie les deux d'un coup d'œil. */}
        {hasMargin && (
          <ClickableTooltip
            content={t("marginTooltip")}
            className="max-w-[15rem] text-center text-xs"
          >
            <button
              type="button"
              className="flex cursor-help items-center gap-1.5"
            >
              <span className="h-2.5 w-4 rounded-[2px] bg-primary/20" />
              <span className="underline decoration-dotted underline-offset-2">
                {t("marginLegend")}
              </span>
            </button>
          </ClickableTooltip>
        )}
      </div>
      {data.forecast.length > 0 && (
        <p className="text-center text-[11px] text-muted-foreground/80">
          {data.meta.preOpening
            ? t("chartForecastPreOpeningNote")
            : t("chartForecastNote")}
        </p>
      )}
      {/* Chiffre d'honnêteté : ce que valent VRAIMENT nos prévisions sur cette
          attraction, mesuré et non postulé. Remplace l'ancien badge
          « Fiabilité : haute », qui ne comptait que des jours d'historique. */}
      {hasMargin && marginMinutes != null && (
        <p className="text-center text-[11px] text-muted-foreground/70">
          {t("marginNote", { minutes: Math.round(marginMinutes) })}
        </p>
      )}
    </div>
  );
}
