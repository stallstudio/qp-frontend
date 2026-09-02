"use client";

import { useTranslations } from "next-intl";
import { DateTime } from "luxon";
import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";
import { BellRing, Star } from "lucide-react";
import { cn, getLuxonFormat } from "@/lib/utils";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { useFavorites } from "@/hooks/useFavorites";
import {
  showReminderKey,
  useNotifications,
} from "@/components/providers/notifications-provider";
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
import {
  calculateParkHours,
  calculateScheduleLanes,
  getParkDayStart,
} from "./utils";

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
  // désormais depuis le popup, comme pour les attractions.
  const { isFavorite } = useFavorites("shows");
  const favKey = (showName: string) => `${parkIdentifier}:${showName}`;

  // Spectacles avec un rappel programmé : une cloche les signale dans la liste.
  const { reminderShowKeys } = useNotifications();
  const [detailTarget, setDetailTarget] = useState<ShowTime | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentTimeRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  // Ligne survolée (uid) : les deux colonnes d'une même ligne s'allument
  // ensemble, comme une ligne du tableau des attractions.
  const [hoveredUid, setHoveredUid] = useState<string | null>(null);
  // true dès que le glisser a réellement déplacé la timeline : le clic final
  // d'un défilement ne doit pas ouvrir le popup.
  const draggedRef = useRef(false);

  const nameRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timelineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [rowHeights, setRowHeights] = useState<number[]>([]);

  const parkHours = useMemo(
    () => calculateParkHours(shows, timezone, parkDate),
    [shows, timezone, parkDate],
  );

  // Origine de la timeline : le début du jour LOGIQUE du parc. Tout se mesure en
  // minutes depuis cet instant, pour qu'une journée qui déborde sur le lendemain
  // (fermeture à minuit passé) reste une seule ligne de temps continue.
  const dayStart = useMemo(
    () => getParkDayStart(timezone, parkDate),
    [timezone, parkDate],
  );

  const now = DateTime.now().setZone(timezone);
  const currentHourPosition = useMemo(
    () => now.diff(dayStart, "minutes").minutes - parkHours[0] * 60,
    [now, dayStart, parkHours],
  );
  // Le repère « maintenant » ne se dessine que s'il tombe DANS la grille : le
  // comparer à `now.hour` le faisait disparaître après minuit (0 h < heure de
  // début), alors qu'on est encore dans la journée du parc.
  const nowInGrid =
    currentHourPosition >= 0 && currentHourPosition <= parkHours.length * 60;

  const sortedShowsWithLanes: ShowWithLanes[] = useMemo(() => {
    const sorted = [...shows].sort((a, b) =>
      a.showName.localeCompare(b.showName),
    );

    return sorted
      .map((show, index) => {
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
      })
      // Un spectacle dont AUCUN créneau ne tombe dans la journée du parc n'a
      // rien à montrer : sa ligne s'affichait vide, sur toute la largeur de la
      // timeline, sans qu'on puisse deviner pourquoi. Cas réel : une source qui
      // range les représentations du soir sous la date du lendemain (elles sont
      // alors écartées par le filtre « ≥ début du jour logique »). Mieux vaut
      // une ligne en moins qu'une ligne muette.
      .filter((item) => item.schedules.length > 0);
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
    draggedRef.current = false;
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
    // Quelques pixels de tolérance : un clic n'est jamais parfaitement immobile.
    if (Math.abs(walk) > 5) draggedRef.current = true;
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
        {/* ⚠️ Fond OPAQUE obligatoire : la colonne est `sticky`, les créneaux
            défileraient visiblement dessous sans lui. Mais `bg-card` en dur
            plaquait un rectangle GRIS au milieu d'une carte d'événement teintée
            (Halloween Horror Nights, capture du 25/08) : la carte n'a pas le
            fond `--card`, elle a un voile rouge posé sur le fond de page.
            `--table-surface` porte cette teinte aplatie, et c'est la carte qui
            la donne (`event-accents.tsx`) ; hors carte d'événement, personne ne
            la définit et le repli rend exactement le fond d'avant. */}
        <div className="w-9/20 sm:w-2/5 shrink-0 sticky left-0 bg-[var(--table-surface,var(--card))] border-e z-10 min-w-0">
          {/* En-tête de la colonne des noms : simple espaceur aligné sur la ligne
              des heures (plus de libellé « MES FAVORIS »). */}
          <div className="h-10 border-b" />
          {displayShows.map((item, index) => {
            const rowHeight = rowHeights[index] || MIN_ROW_HEIGHT;
            const fav = isFavorite(favKey(item.show.showName));
            const hasReminder = reminderShowKeys.has(
              showReminderKey(parkIdentifier, item.show.showName),
            );
            // Même découpage que les attractions : dernier mot + cloche dans un
            // bloc insécable, pour que la cloche ne se retrouve jamais seule sur
            // une ligne. Au-delà de 18 caractères, le dernier mot resterait
            // insécable et déborderait de la colonne : on repasse au flux normal.
            const lastSpace = item.show.showName.lastIndexOf(" ");
            const candidateTail = item.show.showName.slice(lastSpace + 1);
            const glued = hasReminder && candidateTail.length <= 18;
            const nameHead = glued
              ? item.show.showName.slice(0, lastSpace + 1)
              : item.show.showName;
            const nameTail = glued ? candidateTail : "";

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
                  // (le nom démarre au bord, jusqu'au séparateur à droite).
                  // duration-500 : même fondu qu'une ligne d'attraction (là-bas,
                  // la durée sert d'abord au clignotement d'un temps qui change,
                  // mais elle donne aussi son rythme au survol).
                  "border-b flex cursor-pointer items-center pe-2 text-sm font-medium transition-colors duration-500",
                  hoveredUid === item.uid && "bg-[var(--table-row-hover)]",
                  hasFavBoundary &&
                    index === favCount &&
                    "border-t-2 border-border",
                )}
                style={{ height: `${rowHeight}px` }}
                // Comme pour les attractions : toute la ligne ouvre le popup —
                // ici les DEUX moitiés (nom + timeline), qui s'allument aussi
                // ensemble au survol.
                onClick={() => setDetailTarget(item.show)}
                onMouseEnter={() => setHoveredUid(item.uid)}
                onMouseLeave={() =>
                  setHoveredUid((uid) => (uid === item.uid ? null : uid))
                }
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  setDetailTarget(item.show);
                }}
                role="button"
                aria-label={tShowDetail("openFor", {
                  show: item.show.showName,
                })}
              >
                {/* Bloc en FLUX INLINE centré verticalement par le flex parent :
                    le nom coule (multi-lignes possible) et la cloche suit le
                    dernier mot, restant COLLÉE À LA FIN DU TEXTE sur la dernière
                    ligne. */}
                <div className="min-w-0">
                  {/* Étoile jaune-repère devant les spectacles favoris. */}
                  {fav && (
                    <Star className="mr-1 inline-block size-3.5 align-[-2px] fill-amber-400 text-amber-400" />
                  )}
                  <span className="wrap-break-word">{nameHead}</span>
                  {/* Dernier mot + cloche : bloc insécable (voir plus haut).
                      Cloche = au moins un rappel programmé sur ce spectacle,
                      équivalent de l'alerte des attractions. */}
                  <span className="whitespace-nowrap">
                    {nameTail}
                    {hasReminder && (
                      <BellRing
                        aria-label={tShowDetail("reminderScheduled")}
                        className="ms-1.5 inline-block size-3.5 align-[-2px] text-primary"
                      />
                    )}
                  </span>
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
                // `hour` peut valoir 24+ (colonnes d'après minuit) : on AJOUTE
                // les heures au début du jour logique au lieu de les poser avec
                // `set({ hour })`, qui n'accepte que 0–23.
                const hourTime = dayStart.plus({ hours: hour });
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

              {nowInGrid && (
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
                    currentHourPosition={currentHourPosition}
                    is12Hour={is12Hour}
                    dividerTop={hasFavBoundary && showIndex === favCount}
                    rowRef={(el) => {
                      timelineRefs.current[showIndex] = el;
                    }}
                    highlighted={hoveredUid === item.uid}
                    onHoverChange={(hovered) =>
                      setHoveredUid((uid) =>
                        hovered ? item.uid : uid === item.uid ? null : uid,
                      )
                    }
                    // Un glisser pour faire défiler la timeline se termine par un
                    // clic : il ne doit pas ouvrir le popup.
                    onActivate={() => {
                      if (draggedRef.current) return;
                      setDetailTarget(item.show);
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

      {/* Popup « détail spectacle », ouvert par un clic sur une ligne. */}
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
