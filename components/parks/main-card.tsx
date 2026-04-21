"use client";

import { Card } from "@/components/ui/card";
import { AlertCircle, Clock, Drama, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { usePageVisibility } from "@/hooks/usePageVisibility";
import ParkWaitTimeTable from "./wait-time-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useEffect, useState } from "react";
import { ParkLiveData } from "@/types/api";
import ParkShowTimeTable from "./show-time-table";

type MainCardProps = {
  park: ParkLiveData;
  onRefresh?: () => Promise<void>;
};

export default function MainCard({ park, onRefresh }: MainCardProps) {
  const [activeTab, setActiveTab] = useState<string>("");
  const t = useTranslations("waitTimeTable");
  const tTabs = useTranslations("tabs");
  const tShows = useTranslations("shows");
  const tNoData = useTranslations("noData");

  const {
    timeSinceLastUpdate,
    justUpdated,
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
    <Card
      className={`w-full rounded-4xl p-4 gap-0 pb-0 card-shine ${justUpdated ? "card-shine-active" : ""}`}
    >
      {showTabs ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full rounded-3xl">
            <TabsTrigger value="wait-times" className="rounded-3xl">
              <Clock />
              {tTabs("waitTimes")}
            </TabsTrigger>
            <TabsTrigger value="show-times" className="rounded-3xl">
              <Drama />
              {tTabs("shows")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="wait-times">
            <ParkWaitTimeTable
              waitTimes={park.waitTimes}
              queueTypeLabels={park.queueTypeLabels}
            />
          </TabsContent>
          <TabsContent value="show-times">
            <ParkShowTimeTable
              shows={park.shows}
              timezone={park.timezone}
              parkDate={parkDate}
            />
          </TabsContent>
        </Tabs>
      ) : hasWaitTimes ? (
        <ParkWaitTimeTable
          waitTimes={park.waitTimes}
          queueTypeLabels={park.queueTypeLabels}
        />
      ) : hasShows ? (
        <ParkShowTimeTable
          shows={park.shows}
          timezone={park.timezone}
          parkDate={parkDate}
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
