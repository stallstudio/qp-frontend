"use client";

import { useTranslations } from "next-intl";
import { DateTime } from "luxon";
import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { getLuxonFormat } from "@/lib/utils";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { TooltipProvider } from "@/components/ui/tooltip";

import { TimelineRow } from "./components/timeline-row";
import {
  ShowTimeTableProps,
  ShowWithLanes,
  PIXEL_PER_MINUTE,
  LANE_HEIGHT,
  MIN_ROW_HEIGHT,
  ROW_PADDING,
} from "./types";
import {
  getShowDisplayDuration,
  calculateParkHours,
  calculateScheduleLanes,
  formatDuration,
} from "./utils";

export default function ParkShowTimeTable({
  shows,
  timezone,
  parkDate,
}: ShowTimeTableProps) {
  const t = useTranslations("waitTimeTable");
  const { is12Hour } = useTimeFormat();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentTimeRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const nameRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timelineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [rowHeights, setRowHeights] = useState<number[]>([]);

  const parkHours = useMemo(
    () => calculateParkHours(shows, timezone, parkDate),
    [shows, timezone, parkDate],
  );

  const now = DateTime.now().setZone(timezone);
  const currentHourPosition = useMemo(() => {
    const startHour = parkHours[0];
    const minutes = (now.hour - startHour) * 60 + now.minute;
    return minutes;
  }, [now, parkHours]);

  const sortedShowsWithLanes: ShowWithLanes[] = useMemo(() => {
    const sorted = [...shows].sort((a, b) =>
      a.showName.localeCompare(b.showName),
    );

    return sorted.map((show) => {
      const laneInfo = calculateScheduleLanes(
        show.schedules,
        show.duration,
        parkHours[0],
        timezone,
        parkDate,
      );
      return {
        show,
        ...laneInfo,
      };
    });
  }, [shows, parkHours, timezone, parkDate]);

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

  const getMinTimelineHeight = useCallback((totalLanes: number) => {
    return totalLanes * LANE_HEIGHT + ROW_PADDING;
  }, []);

  useEffect(() => {
    const calculateHeights = () => {
      const newHeights: number[] = [];

      sortedShowsWithLanes.forEach((item, index) => {
        const nameEl = nameRefs.current[index];
        const minTimelineHeight = getMinTimelineHeight(item.totalLanes);

        let nameHeight = MIN_ROW_HEIGHT;
        if (nameEl) {
          const currentHeight = nameEl.style.height;
          nameEl.style.height = "auto";
          nameHeight = nameEl.scrollHeight + ROW_PADDING;
          nameEl.style.height = currentHeight;
        }

        const finalHeight = Math.max(
          nameHeight,
          minTimelineHeight,
          MIN_ROW_HEIGHT,
        );
        newHeights.push(finalHeight);
      });

      setRowHeights(newHeights);
    };

    calculateHeights();

    window.addEventListener("resize", calculateHeights);
    return () => window.removeEventListener("resize", calculateHeights);
  }, [sortedShowsWithLanes, getMinTimelineHeight]);

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
        {/* Show names column */}
        <div className="w-2/5 shrink-0 sticky left-0 bg-card border-e z-10 min-w-0">
          <div className="h-10 border-b flex items-center px-3 font-semibold text-sm"></div>
          {sortedShowsWithLanes.map((item, index) => {
            const rowHeight = rowHeights[index] || MIN_ROW_HEIGHT;
            const displayDuration = getShowDisplayDuration(item.show, timezone);

            return (
              <div
                key={index}
                ref={(el) => {
                  nameRefs.current[index] = el;
                }}
                className="border-b flex items-center pe-3 text-sm font-medium"
                style={{ height: `${rowHeight}px` }}
              >
                <div className="flex flex-wrap items-center gap-x-1">
                  <span>{item.show.showName}</span>
                  {displayDuration !== null && (
                    <span className="text-muted-foreground whitespace-nowrap">
                      ({formatDuration(displayDuration)})
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Timeline column */}
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
            {/* Hours header */}
            <div className="h-10 border-b flex relative">
              {parkHours.map((hour) => {
                const hourTime = DateTime.now()
                  .setZone(timezone)
                  .set({ hour, minute: 0 });
                const timeFormat = getLuxonFormat(is12Hour);
                return (
                  <div
                    key={hour}
                    className="shrink-0 border-r border-border/50 flex items-center justify-center text-xs font-semibold text-muted-foreground"
                    style={{ width: `${60 * PIXEL_PER_MINUTE}px` }}
                  >
                    {hourTime.toFormat(timeFormat)}
                  </div>
                );
              })}

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

            {/* Timeline rows */}
            <TooltipProvider delayDuration={0}>
              {sortedShowsWithLanes.map((item, showIndex) => (
                <TimelineRow
                  key={showIndex}
                  schedules={item.schedules}
                  totalLanes={item.totalLanes}
                  rowHeight={rowHeights[showIndex] || MIN_ROW_HEIGHT}
                  parkHours={parkHours}
                  timezone={timezone}
                  now={now}
                  currentHourPosition={currentHourPosition}
                  is12Hour={is12Hour}
                  rowRef={(el) => {
                    timelineRefs.current[showIndex] = el;
                  }}
                />
              ))}
            </TooltipProvider>
          </div>
        </div>
      </div>
    </div>
  );
}
