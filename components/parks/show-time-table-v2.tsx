"use client";

import { useTranslations } from "next-intl";
import { ShowTime } from "@/types/show";
import { DateTime } from "luxon";
import { useMemo, useRef, useEffect, useState } from "react";

type ShowTimeTableV2Props = {
  shows: ShowTime[];
  timezone: string;
};

export default function ParkShowTimeTableV2({
  shows,
  timezone,
}: ShowTimeTableV2Props) {
  const t = useTranslations("waitTimeTable");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentTimeRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const parkHours = useMemo(() => {
    const hours: number[] = [];
    const allTimes = shows.flatMap((show) =>
      show.schedules.map(
        (s) => DateTime.fromISO(s.startTime, { zone: timezone }).hour,
      ),
    );

    if (allTimes.length === 0) {
      for (let h = 9; h <= 23; h++) {
        hours.push(h);
      }
      return hours;
    }

    const minHour = Math.min(...allTimes);
    const maxHour = Math.max(...allTimes);

    const startHour = Math.max(0, minHour - 1);
    const endHour = Math.min(23, maxHour + 2);

    for (let h = startHour; h <= endHour; h++) {
      hours.push(h);
    }

    return hours;
  }, [shows, timezone]);

  const now = DateTime.now().setZone(timezone);
  const currentHourPosition = useMemo(() => {
    const startHour = parkHours[0];
    const minutes = (now.hour - startHour) * 60 + now.minute;
    return minutes;
  }, [now, parkHours]);

  const getSchedulePosition = (startTime: string, duration: number) => {
    const start = DateTime.fromISO(startTime, { zone: timezone });
    const startHour = parkHours[0];
    const minutesFromStart = (start.hour - startHour) * 60 + start.minute;
    const width = duration > 0 ? duration : 30;

    return { left: minutesFromStart, width };
  };

  const calculateScheduleLanes = (
    schedules: ShowTime["schedules"],
    duration: number,
  ) => {
    type ScheduleWithPosition = {
      schedule: ShowTime["schedules"][number];
      left: number;
      width: number;
      lane: number;
    };

    const schedulesWithPositions: ScheduleWithPosition[] = schedules.map(
      (schedule) => {
        const { left, width } = getSchedulePosition(
          schedule.startTime,
          duration,
        );
        return { schedule, left, width, lane: 0 };
      },
    );

    schedulesWithPositions.sort((a, b) => a.left - b.left);

    const lanes: { end: number }[] = [];

    schedulesWithPositions.forEach((item) => {
      let assignedLane = -1;

      for (let i = 0; i < lanes.length; i++) {
        if (lanes[i].end + 5 <= item.left) {
          assignedLane = i;
          break;
        }
      }

      if (assignedLane === -1) {
        assignedLane = lanes.length;
        lanes.push({ end: item.left + item.width });
      } else {
        lanes[assignedLane].end = item.left + item.width;
      }

      item.lane = assignedLane;
    });

    return {
      schedules: schedulesWithPositions,
      totalLanes: lanes.length,
    };
  };

  const sortedShowsWithLanes = useMemo(() => {
    const sorted = [...shows].sort((a, b) =>
      a.showName.localeCompare(b.showName),
    );

    return sorted.map((show) => {
      const laneInfo = calculateScheduleLanes(show.schedules, show.duration);
      return {
        show,
        ...laneInfo,
      };
    });
  }, [shows, timezone, now]);

  useEffect(() => {
    if (scrollContainerRef.current && currentTimeRef.current) {
      const container = scrollContainerRef.current;
      const currentElement = currentTimeRef.current;
      const scrollOffset =
        currentElement.offsetLeft -
        container.offsetWidth / 2 +
        currentElement.offsetWidth / 2;
      container.scrollTo({
        left: Math.max(0, scrollOffset),
        behavior: "smooth",
      });
    }
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
    scrollContainerRef.current.style.cursor = "grabbing";
    scrollContainerRef.current.style.userSelect = "none";
  };

  const handleMouseLeave = () => {
    if (!scrollContainerRef.current) return;
    setIsDragging(false);
    scrollContainerRef.current.style.cursor = "grab";
    scrollContainerRef.current.style.userSelect = "auto";
  };

  const handleMouseUp = () => {
    if (!scrollContainerRef.current) return;
    setIsDragging(false);
    scrollContainerRef.current.style.cursor = "grab";
    scrollContainerRef.current.style.userSelect = "auto";
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  const PIXEL_PER_MINUTE = 2;
  const BASE_ROW_HEIGHT = 10;
  const LANE_HEIGHT = 24;

  if (sortedShowsWithLanes.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        {t("noWaitTimes")}
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden">
      <div className="flex">
        <div className="w-1/2 shrink-0 sticky left-0 bg-card border-e z-10 min-w-0">
          <div className="h-10 border-b flex items-center px-3 font-semibold text-sm"></div>
          {sortedShowsWithLanes.map((item, index) => {
            const rowHeight = BASE_ROW_HEIGHT + item.totalLanes * LANE_HEIGHT;
            return (
              <div
                key={index}
                className="border-b flex items-center px-3 text-sm font-medium text-nowrap overflow-auto scrollbar-hide"
                style={{ height: `${rowHeight}px` }}
              >
                {item.show.showName}
                {item.show.duration !== 0 && (
                  <span className="ps-1 text-muted-foreground">
                    ({item.show.duration} min)
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div
          className="flex-1 overflow-x-auto scrollbar-hide cursor-grab"
          ref={scrollContainerRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
          <div
            className="relative"
            style={{
              width: `${parkHours.length * 60 * PIXEL_PER_MINUTE}px`,
              minWidth: "100%",
            }}
          >
            <div className="h-10 border-b flex relative">
              {parkHours.map((hour, index) => (
                <div
                  key={hour}
                  className="shrink-0 border-r border-border/50 flex items-center justify-center text-xs font-semibold text-muted-foreground"
                  style={{ width: `${60 * PIXEL_PER_MINUTE}px` }}
                >
                  {String(hour).padStart(2, "0")}:00
                </div>
              ))}

              {now.hour >= parkHours[0] &&
                now.hour <= parkHours[parkHours.length - 1] && (
                  <div
                    ref={currentTimeRef}
                    className="absolute top-0 bottom-0 w-0.5 bg-primary z-20"
                    style={{
                      left: `${currentHourPosition * PIXEL_PER_MINUTE}px`,
                    }}
                  >
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full"></div>
                  </div>
                )}
            </div>

            {sortedShowsWithLanes.map((item, showIndex) => {
              const rowHeight = BASE_ROW_HEIGHT + item.totalLanes * LANE_HEIGHT;
              const contentHeight = item.totalLanes * LANE_HEIGHT;
              const verticalPadding = (rowHeight - contentHeight) / 2;

              return (
                <div
                  key={showIndex}
                  className="border-b relative"
                  style={{ height: `${rowHeight}px` }}
                >
                  {parkHours.map((hour, index) => (
                    <div
                      key={hour}
                      className="absolute top-0 bottom-0 border-r border-border/50"
                      style={{
                        left: `${index * 60 * PIXEL_PER_MINUTE}px`,
                        width: `${60 * PIXEL_PER_MINUTE}px`,
                      }}
                    ></div>
                  ))}

                  {item.schedules.map((scheduleItem, schedIndex) => {
                    const scheduleTime = DateTime.fromISO(
                      scheduleItem.schedule.startTime,
                      {
                        zone: timezone,
                      },
                    );
                    const isPast = scheduleTime <= now;

                    const top =
                      verticalPadding + scheduleItem.lane * LANE_HEIGHT + 2;
                    const height = LANE_HEIGHT - 4;

                    return (
                      <div
                        key={schedIndex}
                        className={`absolute rounded-lg flex items-center justify-center text-xs font-medium transition-opacity ${
                          isPast
                            ? "bg-muted/50 text-muted-foreground/50"
                            : "bg-primary/20 text-primary border border-primary/30"
                        }`}
                        style={{
                          left: `${scheduleItem.left * PIXEL_PER_MINUTE}px`,
                          width: `${scheduleItem.width * PIXEL_PER_MINUTE}px`,
                          top: `${top}px`,
                          height: `${height}px`,
                        }}
                      >
                        <span className="truncate">
                          {scheduleTime.toFormat("HH:mm")}
                        </span>
                      </div>
                    );
                  })}

                  {now.hour >= parkHours[0] &&
                    now.hour <= parkHours[parkHours.length - 1] && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-primary z-10 pointer-events-none"
                        style={{
                          left: `${currentHourPosition * PIXEL_PER_MINUTE}px`,
                        }}
                      ></div>
                    )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
