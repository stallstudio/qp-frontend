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
import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useWaitTimeChanges } from "@/hooks/useWaitTimeChanges";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { usePageVisibility } from "@/hooks/usePageVisibility";

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

  const {
    timeSinceLastUpdate,
    isRefreshing,
    justUpdated,
    handleRefresh,
    startIntervals,
    clearIntervals,
  } = useAutoRefresh(lastUpdate, onRefresh, 60000);

  const changedRides = useWaitTimeChanges(waitTimes, 1000);

  usePageVisibility(
    lastUpdate,
    () => {
      const lastUpdateTime = new Date(lastUpdate).getTime();
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

  const sortedWaitTimes = useMemo(
    () =>
      [...waitTimes].sort((a, b) => {
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
      }),
    [waitTimes],
  );

  return (
    <Card
      className={`w-full rounded-4xl px-4 pt-2 gap-0 pb-0 card-shine ${justUpdated ? "card-shine-active" : ""}`}
    >
      <Table className="border-b">
        <TableHeader>
          <TableRow>
            <TableHead className="text-left w-4/6">{t("attraction")}</TableHead>
            <TableHead className="text-left w-1/6">{t("waitTime")}</TableHead>
            <TableHead className="text-left w-1/6">{t("status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="w-full">
          {sortedWaitTimes.length > 0 ? (
            sortedWaitTimes.map((waitTime, index) => (
              <TableRow
                key={index}
                className={`max-w-full transition-colors duration-500 ${
                  changedRides.has(waitTime.rideName) ? "bg-accent" : ""
                }`}
              >
                <TableCell className="font-medium w-4/6 whitespace-normal wrap-break-word">
                  {waitTime.rideName}
                </TableCell>
                <TableCell className="text-left w-1/6 overflow-hidden">
                  {getWaitTimeBadge(waitTime.waitTime)}
                </TableCell>
                <TableCell className="text-left w-1/6 overflow-hidden">
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
