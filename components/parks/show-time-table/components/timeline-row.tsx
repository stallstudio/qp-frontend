"use client";

import { DateTime } from "luxon";
import { getLuxonFormat } from "@/lib/utils";
import { ClickableTooltip } from "./clickable-tooltip";
import {
  ScheduleWithPosition,
  PIXEL_PER_MINUTE,
  LANE_HEIGHT,
  MIN_WIDTH_FOR_TEXT,
} from "../types";

type TimelineRowProps = {
  schedules: ScheduleWithPosition[];
  totalLanes: number;
  rowHeight: number;
  parkHours: number[];
  timezone: string;
  now: DateTime;
  currentHourPosition: number;
  is12Hour: boolean;
  rowRef: (el: HTMLDivElement | null) => void;
};

export function TimelineRow({
  schedules,
  totalLanes,
  rowHeight,
  parkHours,
  timezone,
  now,
  currentHourPosition,
  is12Hour,
  rowRef,
}: TimelineRowProps) {
  const contentHeight = totalLanes * LANE_HEIGHT;
  const verticalPadding = (rowHeight - contentHeight) / 2;

  return (
    <div
      ref={rowRef}
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

      {schedules.map((scheduleItem, schedIndex) => {
        const startTime = DateTime.fromISO(scheduleItem.schedule.startTime, {
          zone: timezone,
        });
        const endTime = startTime.plus({ minutes: scheduleItem.duration });

        // Determine badge state: past, ongoing, or upcoming
        const isPast = endTime <= now;
        const isOngoing = startTime <= now && now < endTime;
        // isUpcoming = startTime > now (default case)

        const widthPx = scheduleItem.width * PIXEL_PER_MINUTE;
        const showTimeText = widthPx >= MIN_WIDTH_FOR_TEXT;

        const top = verticalPadding + scheduleItem.lane * LANE_HEIGHT + 2;
        const height = LANE_HEIGHT - 4;

        const timeText = startTime.toFormat(getLuxonFormat(is12Hour));

        const getBadgeClasses = () => {
          if (isPast) {
            return "bg-muted/50 text-muted-foreground/50";
          }
          if (isOngoing) {
            return "bg-primary/10 text-primary border border-primary/30 border-dashed";
          }
          // Upcoming
          return "bg-primary/20 text-primary border border-primary/30";
        };

        const badgeContent = (
          <div
            className={`absolute rounded-sm flex items-center text-xs font-medium transition-all duration-500 ${getBadgeClasses()}`}
            style={{
              left: `${scheduleItem.left * PIXEL_PER_MINUTE}px`,
              width: `${widthPx}px`,
              top: `${top}px`,
              height: `${height}px`,
              paddingLeft: showTimeText ? "4px" : "0",
              justifyContent: showTimeText ? "flex-start" : "center",
            }}
          >
            {showTimeText && <span>{timeText}</span>}
          </div>
        );

        if (!showTimeText) {
          return (
            <ClickableTooltip key={schedIndex} content={timeText}>
              {badgeContent}
            </ClickableTooltip>
          );
        }

        return <div key={schedIndex}>{badgeContent}</div>;
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
}
