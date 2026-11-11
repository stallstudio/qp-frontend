"use client";

import { useTranslations } from "next-intl";
import { DateTime } from "luxon";
import { Clock, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import WaitTimeChart from "@/components/parks/wait-time-chart";
import { ClickableTooltip } from "@/components/ui/clickable-tooltip";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { getLuxonFormat } from "@/lib/utils";
import { formatWaitMinutes } from "@/lib/wait-time-cap";
import { rangeLookup } from "@/lib/wait-range";
import type { RideHistoryResponse } from "@/types/rideHistory";
import type { WaitTimeStatus } from "@/types/waitTime";

// Cadre de hauteur FIXE, commun à tous les états de la section (voir plus bas).
// Mesuré au 2026-11-07, sur un iPhone en français : en-tête 43 px (la légende
// passe sous le titre), conseil 59 px (deux lignes), note 33 px, trois écarts
// de 8 px — 159 px autour de la courbe, qui garde donc 131 px avec un conseil
// et 198 px sans. Dès `sm`, la légende tient à côté du titre et la note sur une
// ligne : 157 px de courbe avec conseil, 224 px sans.
//
// ⚠️ La courbe ne grandit pas au-delà de 180 px (200 px dès `sm`) : sans
// prévision, ni conseil ni note, elle prenait tout le cadre (≈ 250 px, relevé
// le 2026-11-11 sur Mission Ferrari) et écrasait le popup. Le reste du cadre
// reste vide, en bas, sous le dernier bloc : il se lit comme une marge.
const CHART_FRAME = "flex h-[290px] flex-col sm:h-[280px]";

type ChartSectionProps = {
  // Historique + prévision, récupérés et rafraîchis par le popup parent (partagé
  // avec la section Alertes qui a besoin du statut d'indisponibilité).
  data: RideHistoryResponse | null;
  loading: boolean;
  // Temps standby actuel, si l'attraction est ouverte : point de départ de la
  // phrase de conseil sous le graphique.
  currentWaitTime?: number;
  // État de la file standby : en maintenance, aucun conseil (voir `insightFor`).
  currentStatus?: WaitTimeStatus | null;
  // Seuil d'alerte à tracer (réglage en cours ou alerte active).
  threshold?: number | null;
};

// Écart minimal (min) entre l'attente actuelle et le pic ou le creux prévu pour
// qu'une phrase de conseil vaille d'être dite. En dessous, la prévision est
// dans sa propre marge d'erreur : « ça va monter de 5 min » n'apprend rien.
const INSIGHT_MIN_DELTA = 10;

type Insight = { kind: "rise" | "drop" | "best"; value: number; at: string };

/**
 * Ce que la prévision dit d'utile pour décider : l'attente va nettement monter
 * (« c'est le bon moment »), ou nettement baisser (« mieux vaut patienter »).
 * Rien sinon — une phrase à chaque ouverture finirait par ne plus être lue.
 *
 * Le pic l'emporte sur le creux : rater le bon moment coûte plus cher que
 * patienter pour rien.
 *
 * Sans attente actuelle (panne, file sans temps), il n'y a rien à comparer :
 * on donne alors le MEILLEUR moment prévu, c'est la seule question qui reste.
 *
 * ⚠️ **Rien du tout en MAINTENANCE.** La prévision ne sait pas qu'une
 * attraction est en travaux : elle affichait « Meilleur moment prévu : ~30 min
 * vers 21:45 » sur Crush's Coaster, fermée jusqu'à l'été 2027. Une panne, elle,
 * est passagère : le conseil y reste.
 */
function insightFor(
  data: RideHistoryResponse,
  current: number | undefined,
  status: WaitTimeStatus | null | undefined,
): Insight | null {
  if (status === "maintenance") return null;
  const nowMs = Date.parse(data.now);
  const ahead = data.forecast.filter(
    (p): p is typeof p & { waitTime: number } =>
      p.waitTime != null && Date.parse(p.t) > nowMs,
  );
  if (ahead.length === 0) return null;

  // Premier instant où le maximum (resp. minimum) est atteint.
  const trough = ahead.reduce((a, b) => (b.waitTime < a.waitTime ? b : a));
  if (current == null) {
    return { kind: "best", value: trough.waitTime, at: trough.t };
  }
  const peak = ahead.reduce((a, b) => (b.waitTime > a.waitTime ? b : a));
  if (peak.waitTime - current >= INSIGHT_MIN_DELTA) {
    return { kind: "rise", value: peak.waitTime, at: peak.t };
  }
  if (current - trough.waitTime >= INSIGHT_MIN_DELTA) {
    return { kind: "drop", value: trough.waitTime, at: trough.t };
  }
  return null;
}

const INSIGHT_STYLE: Record<
  Insight["kind"],
  { box: string; key: "insightRise" | "insightDrop" | "insightBest" }
> = {
  rise: { box: "bg-green-500/10 [&_svg]:text-green-500", key: "insightRise" },
  drop: { box: "bg-amber-500/10 [&_svg]:text-amber-500", key: "insightDrop" },
  best: { box: "bg-sky-500/10 [&_svg]:text-sky-500", key: "insightBest" },
};

// Rend le graphique du jour + prévision. États : chargement / indisponible /
// pas de données / graphique.
export default function ChartSection({
  data,
  loading,
  currentWaitTime,
  currentStatus,
  threshold,
}: ChartSectionProps) {
  const t = useTranslations("attractionDetail");
  const { is12Hour } = useTimeFormat();

  // ⚠️ UNE hauteur pour tous les états (2026-11-07) : chargement, message,
  // graphique avec ou sans conseil, note sur une ou deux lignes. Le popup ne
  // change donc pas de taille quand l'historique arrive. Avant, l'attente
  // réservait 196 px et le graphique en prenait 220 à 270 : le popup grandissait
  // juste après l'ouverture, et sautait vers le haut tant qu'il était centré.
  // C'est la courbe qui absorbe l'écart (`flex-1`) : plus haute sans conseil,
  // plus basse avec, ou quand la légende passe sur deux lignes.
  if (loading && !data) {
    return (
      <div className={`${CHART_FRAME} items-center justify-center`}>
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasActual = !!data && data.today.some((p) => p.waitTime != null);
  const hasForecast = !!data && data.forecast.length > 0;
  // La trace ne vaut d'être annoncée en légende que si elle porte assez de
  // points pour DESSINER quelque chose : un point isolé ne trace aucun segment,
  // et une entrée de légende sans trait correspondant se lit comme un bug.
  const hasTrail = !!data && (data.forecastTrail?.length ?? 0) > 1;
  // Marge d'erreur MESURÉE (prévisions passées confrontées à l'observé).
  // ⚠️ La bande « ± X min » a été retirée du graphique : ce chiffre ne se lit
  // plus QUE dans la note sous la courbe.
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
      <div className={`${CHART_FRAME} items-center justify-center text-center text-sm text-muted-foreground`}>
        {message}
      </div>
    );
  }

  const insight = insightFor(data, currentWaitTime, currentStatus);
  const insightTime = insight
    ? DateTime.fromISO(insight.at, { zone: data.timezone }).toFormat(
        getLuxonFormat(is12Hour),
      )
    : null;

  return (
    <div className={`${CHART_FRAME} gap-2 *:shrink-0`}>
      {/* Le titre et la légende sur une ligne : la légende sous la courbe
          prenait une ligne de plus pour trois mots. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-[15px] font-semibold">{t("chartToday")}</h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded bg-primary" />
            {t("chartLegendActual")}
          </span>
          {/* Pas d'échelle qualitative de « fiabilité » : l'indice calculé
              mesure le VOLUME de données disponibles, pas la justesse réelle de
              la prévision. La réserve est portée par « Prévision » elle-même
              (souligné pointillé = explication au survol/tact). */}
          {hasTrail && (
            <span className="flex items-center gap-1.5">
              <span className="w-3 border-t-2 border-dashed border-muted-foreground/45" />
              {t("chartForecastPast")}
            </span>
          )}
          {hasForecast && (
            <ClickableTooltip
              content={t("estimateTooltip")}
              className="max-w-[15rem] text-center text-xs"
            >
              <button
                type="button"
                className="flex cursor-help items-center gap-1.5"
              >
                <span className="w-3 border-t-2 border-dashed border-primary/50" />
                <span className="underline decoration-dotted underline-offset-2">
                  {t("chartForecastLegend")}
                </span>
              </button>
            </ClickableTooltip>
          )}
        </div>
      </div>

      <WaitTimeChart
        today={data.today}
        forecast={data.forecast}
        forecastTrail={data.forecastTrail}
        window={data.window}
        now={data.now}
        timezone={data.timezone}
        nowLabel={t("chartNow")}
        todayLabel={t("chartToday")}
        actualLabel={t("chartActual")}
        forecastLabel={t("chartForecast")}
        trailLabel={t("chartForecastPast")}
        waitCap={data.meta.waitCap}
        valueRanges={data.meta.valueRanges}
        className="h-auto max-h-[180px] min-h-24 shrink! flex-1 sm:h-auto sm:max-h-[200px]"
        threshold={
          threshold != null
            ? {
                value: threshold,
                label: t("alertThresholdLine", { minutes: threshold }),
              }
            : null
        }
      />

      {insight && insightTime && (
        <div
          className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] ${
            INSIGHT_STYLE[insight.kind].box
          }`}
        >
          {insight.kind === "rise" ? (
            <TrendingUp className="size-4 shrink-0" />
          ) : insight.kind === "drop" ? (
            <TrendingDown className="size-4 shrink-0" />
          ) : (
            <Clock className="size-4 shrink-0" />
          )}
          <p className="text-muted-foreground">
            {t.rich(INSIGHT_STYLE[insight.kind].key, {
              minutes: formatWaitMinutes(
                insight.value,
                data.meta.waitCap,
                rangeLookup(data.meta.valueRanges)(insight.value),
              ),
              time: insightTime,
              b: (chunks) => (
                <span className="font-semibold text-foreground">{chunks}</span>
              ),
            })}
          </p>
        </div>
      )}

      {/* UNE ligne de note : ce que vaut la prévision, et ce que valent
          VRAIMENT nos prévisions sur cette attraction, mesuré et non postulé.
          Seule la VALEUR porte l'infobulle (souligné pointillé) : c'est elle
          qu'on peut trouver arbitraire. */}
      {hasForecast && (
        <p className="text-center text-[11px] text-muted-foreground/80">
          {data.meta.preOpening
            ? t("chartForecastPreOpeningNote")
            : t("chartForecastNote")}
          {marginMinutes != null && marginMinutes > 0 && (
            <>
              {" · "}
              {t.rich("marginShort", {
                minutes: Math.round(marginMinutes),
                v: (chunks) => (
                  <ClickableTooltip
                    content={t("marginNoteTooltip")}
                    className="max-w-[13rem] text-center text-xs"
                  >
                    <button
                      type="button"
                      className="cursor-help underline decoration-dotted underline-offset-2"
                    >
                      {chunks}
                    </button>
                  </ClickableTooltip>
                ),
              })}
            </>
          )}
        </p>
      )}
    </div>
  );
}
