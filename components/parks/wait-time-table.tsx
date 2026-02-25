"use client";

import { WaitTime } from "@/types/waitTime";
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
import { useTranslations } from "next-intl";
import { useWaitTimeChanges } from "@/hooks/useWaitTimeChanges";

type WaitTimeTableProps = {
  waitTimes: WaitTime[];
};

export default function ParkWaitTimeTable({ waitTimes }: WaitTimeTableProps) {
  const t = useTranslations("waitTimeTable");

  const changedRides = useWaitTimeChanges(waitTimes, 1000);

  const sortedWaitTimes = useMemo(
    () =>
      [...waitTimes].sort((a, b) => {
        const statusOrder = { open: 0, down: 1, closed: 2, maintenance: 3 };
        const statusDiff = statusOrder[a.status] - statusOrder[b.status];

        if (statusDiff !== 0) return statusDiff;

        if (a.waitTime !== b.waitTime) {
          return b.waitTime - a.waitTime;
        }

        return a.rideName.localeCompare(b.rideName);
      }),
    [waitTimes],
  );

  return (
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
  );
}
