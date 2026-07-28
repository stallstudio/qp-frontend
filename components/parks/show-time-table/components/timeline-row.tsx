"use client";

import { DateTime } from "luxon";
import { cn, getLuxonFormat } from "@/lib/utils";
import { ClickableTooltip } from "@/components/ui/clickable-tooltip";
import {
  ScheduleWithPosition,
  PIXEL_PER_MINUTE,
  LANE_HEIGHT,
  MIN_WIDTH_FOR_TEXT_24H,
  MIN_WIDTH_FOR_TEXT_12H,
} from "../types";

type TimelineRowProps = {
  schedules: ScheduleWithPosition[];
  totalLanes: number;
  rowHeight: number;
  parkHours: number[];
  timezone: string;
  currentHourPosition: number;
  is12Hour: boolean;
  // Trait plus franc en haut : marque la 1re ligne classique après les favoris.
  dividerTop?: boolean;
  rowRef: (el: HTMLDivElement | null) => void;
  // Survol MUTUALISÉ avec la colonne des noms : les deux moitiés d'une même
  // ligne s'allument ensemble, comme une ligne d'attraction.
  highlighted?: boolean;
  onHoverChange?: (hovered: boolean) => void;
  // Clic sur la ligne = ouverture du popup du spectacle (idem colonne des noms).
  onActivate?: () => void;
};

export function TimelineRow({
  schedules,
  totalLanes,
  rowHeight,
  parkHours,
  timezone,
  currentHourPosition,
  is12Hour,
  dividerTop = false,
  rowRef,
  highlighted = false,
  onHoverChange,
  onActivate,
}: TimelineRowProps) {
  const contentHeight = totalLanes * LANE_HEIGHT;
  const verticalPadding = (rowHeight - contentHeight) / 2;

  return (
    <div
      ref={rowRef}
      className={cn(
        // duration-500 : même fondu que la colonne des noms et que les lignes
        // d'attraction, pour que les deux moitiés s'allument à l'unisson.
        "border-b relative cursor-pointer transition-colors duration-500",
        dividerTop && "border-t-2 border-border",
        highlighted && "bg-accent/50",
      )}
      style={{ height: `${rowHeight}px` }}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      onClick={onActivate}
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

        // Compare using timeline positions (minutes from park hours start)
        // This avoids timezone issues by comparing relative positions
        const slotStartMinutes = scheduleItem.left;
        const slotEndMinutes = scheduleItem.left + scheduleItem.duration;

        // Determine badge state: past, ongoing, or upcoming
        const isPast = slotEndMinutes <= currentHourPosition;
        const isOngoing =
          slotStartMinutes <= currentHourPosition &&
          currentHourPosition < slotEndMinutes;
        // isUpcoming = slotStartMinutes > currentHourPosition (default case)

        const widthPx = scheduleItem.width * PIXEL_PER_MINUTE;
        const minWidth = is12Hour
          ? MIN_WIDTH_FOR_TEXT_12H
          : MIN_WIDTH_FOR_TEXT_24H;
        const showTimeText = widthPx >= minWidth;

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
            // Le créneau trop étroit pour afficher son heure porte une info au
            // clic (tactile) : ce clic-là ne doit pas AUSSI ouvrir le popup,
            // d'où l'arrêt de la propagation vers la ligne.
            <span key={schedIndex} onClick={(e) => e.stopPropagation()}>
              <ClickableTooltip content={timeText}>
                {badgeContent}
              </ClickableTooltip>
            </span>
          );
        }

        return <div key={schedIndex}>{badgeContent}</div>;
      })}

      {/* Repère « maintenant » : visible tant que la position tombe DANS la
          grille. Le test sur `now.hour` faisait disparaître le trait après
          minuit alors que la journée du parc n'est pas finie. */}
      {currentHourPosition >= 0 &&
        currentHourPosition <= parkHours.length * 60 && (
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
