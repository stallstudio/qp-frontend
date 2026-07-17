"use client";

import { Card } from "@/components/ui/card";
import { AlertCircle, Clock, Drama, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { getParkStatus } from "@/lib/utils";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { usePageVisibility } from "@/hooks/usePageVisibility";
import ParkWaitTimeTable from "./wait-time-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useEffect, useState } from "react";
import { ParkLiveData } from "@/types/api";
import ParkShowTimeTable from "./show-time-table";

type MainCardProps = {
  park: ParkLiveData;
  history?: Record<number, number[]>;
  onRefresh?: () => Promise<void>;
};

export default function MainCard({
  park,
  history = {},
  onRefresh,
}: MainCardProps) {
  const [activeTab, setActiveTab] = useState<string>("");
  const t = useTranslations("waitTimeTable");
  const tTabs = useTranslations("tabs");
  const tShows = useTranslations("shows");
  const tNoData = useTranslations("noData");

  const {
    timeSinceLastUpdate,
    handleRefresh,
    startIntervals,
    clearIntervals,
  } = useAutoRefresh(park.lastUpdate, onRefresh, 60000);

  usePageVisibility(
    park.lastUpdate,
    () => {
      const lastUpdateTime = new Date(park.lastUpdate).getTime();
      const currentTime = Date.now();
      const timeSinceUpdate = currentTime - lastUpdateTime;

      if (timeSinceUpdate > 60 * 1000) {
        handleRefresh();
      }

      const calculateRemainingSeconds = () => {
        const targetTime = lastUpdateTime + 60 * 1000;
        const remainingMs = targetTime - Date.now();
        return Math.ceil(remainingMs / 1000);
      };
      startIntervals(calculateRemainingSeconds);
    },
    clearIntervals,
    60000,
  );

  const hasWaitTimes = park.waitTimes && park.waitTimes.length > 0;
  const hasShows = park.shows && park.shows.length > 0;
  const showTabs = hasWaitTimes && hasShows;
  const parkDate = park.openingHours?.[0]?.date ?? null;

  // Parc « fermé » = on a des horaires pour le jour mais l'heure courante est
  // hors de ces plages. Dans ce cas les flèches de tendance n'ont plus de sens
  // (temps figés) et on les masque. En revanche, si aucun horaire n'est connu
  // (statut « unknown » — souvent une simple erreur de récupération), on garde
  // tout pour ne pas dégrader l'expérience.
  const parkClosed = getParkStatus(park.openingHours) === "closed";

  useEffect(() => {
    if (showTabs) {
      if (hasShows && !hasWaitTimes) {
        setActiveTab("show-times");
      } else {
        setActiveTab("wait-times");
      }
    }
  }, []);
  return (
    <Card className="w-full rounded-4xl p-2.5 sm:p-4 gap-0 pb-0">
      {showTabs ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="relative w-full rounded-3xl overflow-hidden">
            {/* Pastille coulissante façon iOS : glisse d'un onglet à l'autre.
                Deux onglets de largeur égale -> largeur 50% (moins le padding),
                translation 0% / 100%. Courbe d'accélération type iOS. */}
            <span
              aria-hidden
              className="pointer-events-none absolute top-[3px] bottom-[3px] left-[3px] w-[calc(50%-3px)] rounded-3xl bg-background shadow-sm dark:bg-input/30 dark:border dark:border-input"
              style={{
                transform:
                  activeTab === "show-times"
                    ? "translateX(100%)"
                    : "translateX(0%)",
                transitionProperty: "transform",
                transitionDuration: "1000ms",
                transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
              }}
            />
            <TabsTrigger
              value="wait-times"
              className="relative z-10 rounded-3xl data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent dark:data-[state=active]:border-transparent"
            >
              <Clock />
              {tTabs("waitTimes")}
            </TabsTrigger>
            <TabsTrigger
              value="show-times"
              className="relative z-10 rounded-3xl data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent dark:data-[state=active]:border-transparent"
            >
              <Drama />
              {tTabs("shows")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="wait-times">
            <ParkWaitTimeTable
              waitTimes={park.waitTimes}
              queueTypeLabels={park.queueTypeLabels}
              parkIdentifier={park.identifier}
              history={history}
              parkClosed={parkClosed}
            />
          </TabsContent>
          <TabsContent value="show-times">
            <ParkShowTimeTable
              shows={park.shows}
              timezone={park.timezone}
              parkDate={parkDate}
              parkIdentifier={park.identifier}
            />
          </TabsContent>
        </Tabs>
      ) : hasWaitTimes ? (
        <ParkWaitTimeTable
          waitTimes={park.waitTimes}
          queueTypeLabels={park.queueTypeLabels}
          parkIdentifier={park.identifier}
          history={history}
          parkClosed={parkClosed}
        />
      ) : hasShows ? (
        <ParkShowTimeTable
          shows={park.shows}
          timezone={park.timezone}
          parkDate={parkDate}
          parkIdentifier={park.identifier}
        />
      ) : null}
      {park.shows.length === 0 && park.waitTimes.length === 0 && (
        <div className="flex items-center justify-center flex-col gap-y-0.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="size-3.5" />
            <h3 className="font-medium tracking-tight text-center">
              {tNoData("title")}
            </h3>
          </div>
          <p className="text-center">{tNoData("message")}</p>
        </div>
      )}
      <div className="flex justify-center text-sm text-muted-foreground my-4 flex-col items-center">
        {timeSinceLastUpdate > 0 ? (
          <p>
            {t("refreshingIn")} {timeSinceLastUpdate}{" "}
            {timeSinceLastUpdate < 2 ? t("second") : t("seconds")}
          </p>
        ) : timeSinceLastUpdate > -20 ? (
          <div className="flex text-muted-foreground items-center gap-1">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("nowRefreshing")}
          </div>
        ) : (
          <p>
            {t("lastUpdate")}: {new Date(park.lastUpdate).toLocaleString()}
          </p>
        )}
        {park.shows.length > 0 && activeTab === "show-times" && (
          <p>{tShows("updateInfo")}</p>
        )}
      </div>
    </Card>
  );
}
