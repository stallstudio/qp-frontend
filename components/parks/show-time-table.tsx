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
import DisplaySchedules from "./display-schedules";

type ShowTimeTableProps = {
  shows: ShowTime[];
  timezone: string;
};

export default function ParkShowTimeTable({
  shows,
  timezone,
}: ShowTimeTableProps) {
  const t = useTranslations("waitTimeTable");
  const tShows = useTranslations("shows");

  const hasDuration = useMemo(() => {
    return shows.some((show) => show.duration > 0);
  }, [shows]);

  const sortedShows = useMemo(() => {
    const now = DateTime.now().setZone(timezone);

    const getNextScheduleTime = (show: ShowTime) => {
      const futureSchedules = show.schedules
        .map((schedule) =>
          DateTime.fromISO(schedule.startTime, { zone: timezone }),
        )
        .filter((scheduleTime) => scheduleTime > now)
        .sort((a, b) => a.toMillis() - b.toMillis());

      return futureSchedules.length > 0 ? futureSchedules[0] : null;
    };

    return [...shows].sort((a, b) => {
      const aNextTime = getNextScheduleTime(a);
      const bNextTime = getNextScheduleTime(b);

      // Si un spectacle a un prochain créneau et l'autre non
      if (aNextTime && !bNextTime) return -1;
      if (!aNextTime && bNextTime) return 1;

      // Si les deux ont des créneaux futurs, trier par le plus proche
      if (aNextTime && bNextTime) {
        return aNextTime.toMillis() - bNextTime.toMillis();
      }

      // Si aucun n'a de créneaux futurs, trier alphabétiquement
      return a.showName.localeCompare(b.showName);
    });
  }, [shows, timezone]);

  return (
    <Table className="border-b">
      <TableHeader>
        <TableRow>
          <TableHead className="text-left">{tShows("show")}</TableHead>
          {hasDuration && (
            <TableHead className="text-center w-[100px]">
              {tShows("duration")}
            </TableHead>
          )}
          <TableHead className="text-center w-[150px] sm:w-[200px] md:w-[250px] lg:w-[300px] xl:w-[400px]">
            {tShows("schedules")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="w-full">
        {sortedShows.length > 0 ? (
          sortedShows.map((showTime, index) => (
            <TableRow key={index} className="max-w-full">
              <TableCell className="font-medium whitespace-normal wrap-break-word">
                {showTime.showName}
              </TableCell>
              {hasDuration && (
                <TableCell className="text-center">
                  {showTime.duration > 0 ? `${showTime.duration} min` : "-"}
                </TableCell>
              )}
              <TableCell className="w-[150px] sm:w-[200px] md:w-[250px] lg:w-[300px] xl:w-[400px] py-2">
                <DisplaySchedules
                  schedules={showTime.schedules}
                  timezone={timezone}
                />
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell
              colSpan={hasDuration ? 3 : 2}
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
