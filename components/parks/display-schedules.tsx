"use client";

import { DateTime } from "luxon";
import { useMemo, useRef, useEffect } from "react";
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

  const formatSchedule = (startTime: string) => {
    const start = DateTime.fromISO(startTime, { zone: timezone });
    return start.toFormat("HH:mm");
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

  const nextScheduleIndex = useMemo(() => {
    const index = schedulesWithStatus.findIndex((s) => !s.isPast);
    return index !== -1 ? index : 0;
  }, [schedulesWithStatus]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const nextScheduleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current && nextScheduleRef.current) {
      const container = scrollContainerRef.current;
      const nextElement = nextScheduleRef.current;
      const scrollOffset =
        nextElement.offsetLeft -
        container.offsetWidth / 2 +
        nextElement.offsetWidth / 2;
      container.scrollTo({ left: scrollOffset, behavior: "smooth" });
    }
  }, [schedulesWithStatus]);

  if (!hasRemainingSchedules) {
    return (
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-muted-foreground">
          {tShows("noMoreToday")}
        </Badge>
      </div>
    );
  }

  if (schedulesWithStatus.length === 0) {
    return null;
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex items-center gap-2 overflow-x-scroll scrollbar-hide"
    >
      {schedulesWithStatus.map((schedule, index) => (
        <Badge
          key={index}
          ref={index === nextScheduleIndex ? nextScheduleRef : null}
          variant="outline"
          className={`whitespace-nowrap shrink-0 ${schedule.isPast ? "opacity-25" : ""}`}
        >
          {formatSchedule(schedule.startTime)}
        </Badge>
      ))}
    </div>
  );
}
