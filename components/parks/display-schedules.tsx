"use client";

import { DateTime } from "luxon";
import { useMemo } from "react";
import { Badge } from "../ui/badge";
import { useTranslations } from "next-intl";

type DisplaySchedulesProps = {
  schedules: { startTime: string; endTime?: string | null }[];
  timezone: string;
};

export default function DisplaySchedules({
  schedules,
  timezone,
}: DisplaySchedulesProps) {
  const tShows = useTranslations("shows");
  const now = DateTime.now().setZone(timezone);

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

  const schedulesWithStatus = useMemo(() => {
    return schedules.map((schedule) => {
      const scheduleTime = DateTime.fromISO(schedule.startTime, {
        zone: timezone,
      });
      return {
        ...schedule,
        isPast: scheduleTime <= now,
      };
    });
  }, [schedules, timezone, now]);

  const hasRemainingSchedules = schedulesWithStatus.some((s) => !s.isPast);

  if (!hasRemainingSchedules) {
    return (
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-muted-foreground">
          {tShows("noMoreToday")}
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {schedulesWithStatus.map((schedule, index) => (
        <Badge
          key={index}
          variant="outline"
          className={schedule.isPast ? "opacity-25" : ""}
        >
          {formatSchedule(schedule.startTime, schedule.endTime)}
        </Badge>
      ))}
    </div>
  );
}
