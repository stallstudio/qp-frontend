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

// Récupère l'historique du jour + prévision pour l'attraction (à la demande) et
// rend le graphique. États chargement / vide / ok.
export default function ChartSection({
  parkIdentifier,
  rideId,
}: ChartSectionProps) {
  const t = useTranslations("attractionDetail");
  const [data, setData] = useState<RideHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    axios
      .get<{ data: RideHistoryResponse }>(
        `/api/park/${parkIdentifier}/ride/${rideId}/history`,
        { signal: controller.signal },
      )
      .then((res) => setData(res.data.data))
      .catch(() => {
        // Le graphique est un bonus : en cas d'échec on montre l'état vide.
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [parkIdentifier, rideId]);

  if (loading) {
    return (
      <div className="flex h-[168px] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasData = data && data.today.some((p) => p.waitTime != null);
  if (!hasData) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {t("chartEmpty")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <WaitTimeChart
        today={data.today}
        forecast={data.forecast}
        window={data.window}
        now={data.now}
        timezone={data.timezone}
        nowLabel={t("chartNow")}
        todayLabel={t("chartToday")}
        forecastLabel={t("chartForecast")}
      />
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
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
      </div>
      {data.forecast.length > 0 && (
        <p className="text-center text-[11px] text-muted-foreground/80">
          {t("chartForecastNote")}
        </p>
      )}
    </div>
  );
}
