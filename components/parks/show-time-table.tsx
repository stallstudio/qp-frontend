"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
  TableHead,
} from "@/components/ui/table";
import { useTranslations } from "next-intl";
import { ShowTime } from "@/types/show";
import { DateTime } from "luxon";
import { useMemo } from "react";

type ShowTimeTableProps = {
  shows: ShowTime[];
  timezone: string;
};

export default function ParkShowTimeTable({
  shows,
  timezone,
}: ShowTimeTableProps) {
  const t = useTranslations("waitTimeTable");

  const sortedShows = useMemo(() => {
    const now = DateTime.now().setZone(timezone);

    const hasRemainingSchedules = (show: ShowTime) => {
      return show.schedules.some((schedule) => {
        const scheduleTime = DateTime.fromISO(schedule.startTime, {
          zone: timezone,
        });
        return scheduleTime > now;
      });
    };

    return [...shows].sort((a, b) => {
      const aHasRemaining = hasRemainingSchedules(a);
      const bHasRemaining = hasRemainingSchedules(b);

      if (aHasRemaining && !bHasRemaining) return -1;
      if (!aHasRemaining && bHasRemaining) return 1;

      return a.showName.localeCompare(b.showName);
    });
  }, [shows, timezone]);

  const formatSchedule = (startTime: string, endTime?: string | null) => {
    const start = DateTime.fromISO(startTime, { zone: timezone });
    const formattedStart = start.toFormat("HH:mm");

    if (endTime) {
      const end = DateTime.fromISO(endTime, { zone: timezone });
      const formattedEnd = end.toFormat("HH:mm");
      return `${formattedStart} - ${formattedEnd}`;
    }

    return formattedStart;
  };

  return (
    <Table className="border-b">
      <TableHeader>
        <TableRow>
          <TableHead className="text-left w-[400px]">Spectacle</TableHead>
          <TableHead className="text-left">Horaires</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="w-full">
        {sortedShows.length > 0 ? (
          sortedShows.map((showTime, index) => (
            <TableRow key={index} className="max-w-full">
              <TableCell className="font-medium w-[400px] whitespace-normal wrap-break-word">
                {showTime.showName}{" "}
                {showTime.duration > 0 && `(${showTime.duration} min)`}
              </TableCell>
              <TableCell className="text-left text-wrap whitespace-normal">
                {showTime.schedules
                  .map((schedule) =>
                    formatSchedule(schedule.startTime, schedule.endTime),
                  )
                  .join(", ")}
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
