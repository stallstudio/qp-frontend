"use client";

import { WaitTime } from "@/types/waitTime";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
  TableHead,
} from "@/components/ui/table";
import { getStatusBadge, getWaitTimeBadge } from "@/lib/badge";
import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

type WaitTimeTableProps = {
  waitTimes: WaitTime[];
  lastUpdate: string;
  onRefresh?: () => Promise<void>;
};

export default function ParkWaitTimeTable({
  waitTimes,
  lastUpdate,
  onRefresh,
}: WaitTimeTableProps) {
  const t = useTranslations("waitTimeTable");
  const [timeSinceLastUpdate, setTimeSinceLastUpdate] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const calculateRemainingSeconds = () => {
    const lastUpdateTime = new Date(lastUpdate).getTime();
    const targetTime = lastUpdateTime + 60 * 1000; // +1 minute
    const currentTime = Date.now();

    const remainingMs = targetTime - currentTime;
    const remainingSeconds = Math.ceil(remainingMs / 1000);

    return remainingSeconds;
  };

  const handleRefresh = useCallback(async () => {
    if (!onRefresh || isRefreshing) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, isRefreshing]);

  useEffect(() => {
    // Mise à jour immédiate
    setTimeSinceLastUpdate(calculateRemainingSeconds());

    // Intervalle pour le décompte (toutes les secondes)
    const countdownInterval = setInterval(() => {
      setTimeSinceLastUpdate(calculateRemainingSeconds());
    }, 1000);

    // Intervalle pour le rafraîchissement des données (toutes les 2 secondes)
    const refreshInterval = setInterval(() => {
      const newTimeSinceLastUpdate = calculateRemainingSeconds();

      // Si timeSinceLastUpdate est = ou inférieur à 0 (donc 1 minute ou plus écoulée)
      // ET qu'on est pas encore à -20 secondes (donc pas plus de 1 minute et 20 secondes)
      // ET qu'on a pas encore atteint 10 tentatives
      if (newTimeSinceLastUpdate <= 0 && newTimeSinceLastUpdate > -20) {
        handleRefresh();
      }
    }, 2000);

    return () => {
      clearInterval(countdownInterval);
      clearInterval(refreshInterval);
    };
  }, [lastUpdate, handleRefresh]);

  const sortedWaitTimes = [...waitTimes].sort((a, b) => {
    // Ordre des status: open (0), down (1), closed (2), maintenance (3)
    const statusOrder = { open: 0, down: 1, closed: 2, maintenance: 3 };
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];

    if (statusDiff !== 0) return statusDiff;

    // Si même status, trier par wait time - du plus haut au plus bas
    if (a.waitTime !== b.waitTime) {
      return b.waitTime - a.waitTime;
    }

    // Enfin, trier par nom
    return a.rideName.localeCompare(b.rideName);
  });

  return (
    <Card className="w-full rounded-4xl px-4 pt-2 gap-0 pb-0">
      <Table className="border-b">
        <TableHeader>
          <TableRow>
            <TableHead className="text-left w-4/6">{t("attraction")}</TableHead>
            <TableHead className="text-left w-1/6">{t("waitTime")}</TableHead>
            <TableHead className="text-left w-1/6">{t("status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedWaitTimes.length > 0 ? (
            sortedWaitTimes.map((waitTime, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">
                  {waitTime.rideName}
                </TableCell>
                <TableCell className="text-left">
                  {getWaitTimeBadge(waitTime.waitTime)}
                </TableCell>
                <TableCell className="text-left">
                  {getStatusBadge(waitTime.status)}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={3}
                className="text-center text-muted-foreground"
              >
                {t("noWaitTimes")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="flex justify-center text-sm text-muted-foreground my-4">
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
            {t("lastUpdate")}: {new Date(lastUpdate).toLocaleString()}
          </p>
        )}
      </div>
    </Card>
  );
}
