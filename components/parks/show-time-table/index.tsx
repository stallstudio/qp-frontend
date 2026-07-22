"use client";

import { useTranslations } from "next-intl";
import { DateTime } from "luxon";
import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";
import { Eye, Star } from "lucide-react";
import { cn, getLuxonFormat } from "@/lib/utils";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { useFavorites } from "@/hooks/useFavorites";
import { TooltipProvider } from "@/components/ui/tooltip";
import ShowDetailDialog from "@/components/parks/show-detail/show-detail-dialog";
import type { ShowTime } from "@/types/show";

import { TimelineRow } from "./components/timeline-row";
import {
  ShowTimeTableProps,
  ShowWithLanes,
  PIXEL_PER_MINUTE,
  LANE_HEIGHT,
  MIN_ROW_HEIGHT,
  ROW_PADDING,
} from "./types";
import { calculateParkHours, calculateScheduleLanes } from "./utils";

export default function ParkShowTimeTable({
  shows,
  timezone,
  parkDate,
  parkIdentifier,
  parkName,
}: ShowTimeTableProps) {
  const t = useTranslations("waitTimeTable");
  const tShows = useTranslations("shows");
  const tShowDetail = useTranslations("showDetail");
  const { is12Hour } = useTimeFormat();

  // isFavorite sert à épingler les favoris en tête ; le (dé)favori se fait
  // désormais depuis le popup (œil), comme pour les attractions.
  const { isFavorite } = useFavorites("shows");
  const favKey = (showName: string) => `${parkIdentifier}:${showName}`;
  const [detailTarget, setDetailTarget] = useState<ShowTime | null>(null);
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

    return sorted.map((show, index) => {
      const laneInfo = calculateScheduleLanes(
        show.schedules,
        show.duration,
        parkHours[0],
        timezone,
        parkDate,
      );
      return {
        show,
        // Index de tri suffixé au nom : garantit une clé unique même si deux
        // spectacles partagent le même nom (sinon React duplique/omet les lignes).
        uid: `${index}::${show.showName}`,
        ...laneInfo,
      };
    });
  }, [shows, parkHours, timezone, parkDate]);

  // Favoris épinglés en tête, sans recalculer les lanes (tri d'affichage léger).
  const displayShows: ShowWithLanes[] = useMemo(() => {
    return [...sortedShowsWithLanes].sort((a, b) => {
      const aFav = isFavorite(favKey(a.show.showName));
      const bFav = isFavorite(favKey(b.show.showName));
      if (aFav !== bFav) return aFav ? -1 : 1;
      return 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedShowsWithLanes, isFavorite]);

  // Signature de l'ordre courant : ne (ré)anime le `layout` que lors d'un vrai
  // reclassement (mise en favori d'un spectacle -> remontée en tête).
  const orderKey = displayShows.map((s) => s.uid).join(",");
  // Frontière favoris / spectacles classiques (favoris épinglés en tête) : la
  // 1re ligne classique reçoit un trait plus franc pour distinguer les groupes.
  const favCount = displayShows.filter((s) =>
    isFavorite(favKey(s.show.showName)),
  ).length;
  const hasFavBoundary = favCount > 0 && favCount < displayShows.length;

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

      displayShows.forEach((item, index) => {
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
  }, [displayShows, getMinTimelineHeight]);

  if (displayShows.length === 0) {
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
        <div className="w-9/20 sm:w-2/5 shrink-0 sticky left-0 bg-card border-e z-10 min-w-0">
          {/* En-tête de la colonne des noms : simple espaceur aligné sur la ligne
              des heures (plus de libellé « MES FAVORIS »). */}
          <div className="h-10 border-b" />
          {displayShows.map((item, index) => {
            const rowHeight = rowHeights[index] || MIN_ROW_HEIGHT;
            const fav = isFavorite(favKey(item.show.showName));

            return (
              <motion.div
                layout="position"
                layoutDependency={orderKey}
                key={item.uid}
                transition={{ type: "spring", stiffness: 320, damping: 36 }}
                ref={(el) => {
                  nameRefs.current[index] = el;
                }}
                className={cn(
                  // Alignement identique aux attractions : pas de retrait à gauche
                  // (le nom démarre au bord, jusqu'au séparateur à droite), œil
                  // accolé À LA FIN DU NOM.
                  "group border-b flex items-center pe-2 text-sm font-medium",
                  hasFavBoundary &&
                    index === favCount &&
                    "border-t-2 border-border",
                )}
                style={{ height: `${rowHeight}px` }}
              >
                {/* Bloc en FLUX INLINE centré verticalement par le flex parent :
                    le nom coule (multi-lignes possible) et l'œil suit le dernier
                    mot, restant COLLÉ À LA FIN DU TEXTE sur la dernière ligne. */}
                <div className="min-w-0">
                  {/* Étoile jaune-repère devant les spectacles favoris. */}
                  {fav && (
                    <Star className="mr-1 inline-block size-3.5 align-[-2px] fill-amber-400 text-amber-400" />
                  )}
                  <span className="wrap-break-word">{item.show.showName}</span>
                  {/* Œil : ouvre le popup détail (durée + favori + alertes). */}
                  <button
                    type="button"
                    onClick={() => setDetailTarget(item.show)}
                    aria-label={tShowDetail("openFor", {
                      show: item.show.showName,
                    })}
                    className="ml-1 inline-flex align-middle rounded-md text-muted-foreground transition-colors hover:text-primary"
                  >
                    <Eye className="size-3.5" />
                  </button>
                </div>
              </motion.div>
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
              {displayShows.map((item, showIndex) => (
                // Enveloppe animée : le reclassement (mise en favori) glisse au
                // lieu de sauter, en phase avec la colonne des noms (même clé
                // stable, même ressort).
                <motion.div
                  key={item.uid}
                  layout="position"
                  layoutDependency={orderKey}
                  transition={{ type: "spring", stiffness: 320, damping: 36 }}
                >
                  <TimelineRow
                    schedules={item.schedules}
                    totalLanes={item.totalLanes}
                    rowHeight={rowHeights[showIndex] || MIN_ROW_HEIGHT}
                    parkHours={parkHours}
                    timezone={timezone}
                    now={now}
                    currentHourPosition={currentHourPosition}
                    is12Hour={is12Hour}
                    dividerTop={hasFavBoundary && showIndex === favCount}
                    rowRef={(el) => {
                      timelineRefs.current[showIndex] = el;
                    }}
                  />
                </motion.div>
              ))}
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* Légende : signification visuelle des créneaux (terminé / en cours / à venir). */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 px-3 pt-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm border border-border bg-muted/50" />
          {tShows("legendPast")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm border border-dashed border-primary/30 bg-primary/10" />
          {tShows("legendOngoing")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm border border-primary/30 bg-primary/20" />
          {tShows("legendUpcoming")}
        </span>
      </div>

      {/* Popup « détail spectacle », piloté par l'œil de chaque ligne. */}
      <ShowDetailDialog
        target={detailTarget}
        parkIdentifier={parkIdentifier}
        parkName={parkName}
        timezone={timezone}
        onOpenChange={(open) => {
          if (!open) setDetailTarget(null);
        }}
      />
    </div>
  );
}
