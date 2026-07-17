"use client";

import { WaitTime, QueueTime } from "@/types/waitTime";
import { motion } from "motion/react";
import { getStatusBadge, getTimeSlotBadge, getWaitTimeBadge } from "@/lib/badge";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useWaitTimeChanges } from "@/hooks/useWaitTimeChanges";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { useFavorites } from "@/hooks/useFavorites";
import { useUser } from "@/components/providers/user-provider";
import FavoriteStar from "@/components/ui/favorite-star";
import WaitTrend from "@/components/parks/wait-trend";
import CreateNotificationDialog, {
  type NotificationTarget,
} from "@/components/notifications/create-notification-dialog";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ChevronUp,
  ChevronDown,
  User,
  Clock,
  Bell,
  FastForward,
  CornerDownRight,
} from "lucide-react";

type QueueTypeInfo = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const QUEUE_TYPE_MAP: Record<string, QueueTypeInfo> = {
  fastlane: {
    label: "Fastlane",
    icon: FastForward,
  },
  singlerider: {
    label: "Single Rider",
    icon: User,
  },
  virtualqueue: {
    label: "Virtual Queue",
    icon: Clock,
  },
};

type SortKey = "name" | "wait" | "status";
type SortDir = "asc" | "desc";

// Direction "naturelle" au premier clic sur une colonne.
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  name: "asc",
  wait: "desc",
  status: "asc",
};

type WaitTimeTableProps = {
  waitTimes: WaitTime[];
  queueTypeLabels?: Record<string, string> | null;
  parkIdentifier: string;
  parkName: string;
  history?: Record<number, number[]>;
  // Vrai quand le parc a des horaires connus et qu'il est actuellement fermé.
  // Dans ce cas on masque les flèches de tendance (les temps sont figés / la
  // tendance n'a plus de sens). Voir usage plus bas.
  parkClosed?: boolean;
};

const STATUS_ORDER = { open: 0, down: 1, closed: 2, maintenance: 3 } as const;

// SUSPENDU : les flèches de tendance dépendent de l'historique, désactivé pour
// le moment (voir HISTORY_ENABLED dans park-page-client.tsx). On garde tout le
// code de rendu ci-dessous ; repasser ce drapeau à `true` pour réactiver.
const TRENDS_ENABLED = false;

// Grille partagée par l'en-tête et chaque ligne pour aligner les 3 colonnes.
// Chaque ligne est une grille indépendante : impossible de laisser les pistes
// s'auto-dimensionner au contenu (elles ne seraient plus alignées d'une ligne à
// l'autre). Comme l'ancienne table, on privilégie les colonnes Temps/État
// (badge + flèche de tendance, « En panne » sur une ligne) et le nom prend le
// reste (donc plus étroit) :
// - mobile : Temps en largeur fixe (4rem, resserré : la flèche de tendance étant
//   suspendue, le badge seul n'a plus besoin de place) et État (6rem, assez pour
//   « Maintenance »). Tracks volontairement étroites pour laisser le MAXIMUM de
//   largeur au nom de l'attraction (moins de retours à la ligne). Le badge Temps
//   reste aligné à GAUCHE (défaut) ;
// - ≥ sm : mêmes proportions que l'ancienne table (4/6 · 1/6 · 1/6).
const GRID_COLS =
  "grid items-center grid-cols-[minmax(0,1fr)_4rem_6rem] sm:grid-cols-[minmax(0,4fr)_minmax(0,1fr)_minmax(0,1fr)]";

function getPrimaryQueue(wt: WaitTime): QueueTime | undefined {
  return wt.queues.find((q) => q.type === "standby") || wt.queues[0];
}

export default function ParkWaitTimeTable({
  waitTimes,
  queueTypeLabels,
  parkIdentifier,
  parkName,
  history = {},
  parkClosed = false,
}: WaitTimeTableProps) {
  const t = useTranslations("waitTimeTable");
  const tStatus = useTranslations("attractionStatus");
  const tFav = useTranslations("favorites");
  const tNotif = useTranslations("notifications");
  const { is12Hour } = useTimeFormat();
  const { isAuthenticated } = useUser();
  const [notifTarget, setNotifTarget] = useState<NotificationTarget | null>(
    null,
  );
  const [expandedRides, setExpandedRides] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const { isFavorite, toggle } = useFavorites("rides");
  const favKey = (rideId: number) => `${parkIdentifier}:${rideId}`;

  const statusLabels: Record<string, string> = {
    open: tStatus("open"),
    closed: tStatus("closed"),
    down: tStatus("down"),
    maintenance: tStatus("maintenance"),
  };
  // « Indisponible » est le badge le plus large : version courte sur mobile
  // (« Indispo. ») pour qu'il rentre dans la colonne Temps, complète dès sm.
  const unavailableLabel = (
    <>
      <span className="sm:hidden">{tStatus("unavailableShort")}</span>
      <span className="hidden sm:inline">{tStatus("unavailable")}</span>
    </>
  );

  const changedRides = useWaitTimeChanges(waitTimes, 3000);

  const getQueueLabel = (queueType: string): string => {
    if (queueTypeLabels && queueTypeLabels[queueType]) {
      return queueTypeLabels[queueType];
    }
    if (QUEUE_TYPE_MAP[queueType]) {
      return QUEUE_TYPE_MAP[queueType].label;
    }
    return queueType.charAt(0).toUpperCase() + queueType.slice(1);
  };

  const toggleExpand = (rideId: number) => {
    setExpandedRides((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rideId)) {
        newSet.delete(rideId);
      } else {
        newSet.add(rideId);
      }
      return newSet;
    });
  };

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key]);
    }
  };

  const sortedWaitTimes = useMemo(() => {
    const mult = sortDir === "asc" ? 1 : -1;

    return [...waitTimes].sort((a, b) => {
      // Favoris toujours épinglés en tête, quel que soit le tri.
      const aFav = isFavorite(favKey(a.rideId));
      const bFav = isFavorite(favKey(b.rideId));
      if (aFav !== bFav) return aFav ? -1 : 1;

      const aQueue = getPrimaryQueue(a);
      const bQueue = getPrimaryQueue(b);

      if (sortKey === "name") {
        return mult * a.rideName.localeCompare(b.rideName);
      }

      if (sortKey === "wait") {
        const aw = aQueue?.waitTime ?? -1;
        const bw = bQueue?.waitTime ?? -1;
        if (aw !== bw) return mult * (aw - bw);
        return a.rideName.localeCompare(b.rideName);
      }

      // status
      const as = aQueue ? STATUS_ORDER[aQueue.status] : 99;
      const bs = bQueue ? STATUS_ORDER[bQueue.status] : 99;
      if (as !== bs) return mult * (as - bs);
      const aw = aQueue?.waitTime ?? -1;
      const bw = bQueue?.waitTime ?? -1;
      if (aw !== bw) return bw - aw;
      return a.rideName.localeCompare(b.rideName);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitTimes, sortKey, sortDir, isFavorite]);

  const sortIndicator = (key: SortKey) => {
    if (key !== sortKey) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="size-3.5" />
    ) : (
      <ChevronDown className="size-3.5" />
    );
  };

  const sortButtonClass =
    "inline-flex items-center gap-1 cursor-pointer select-none hover:text-foreground transition-colors";

  // Signature de l'ordre courant : on ne (ré)anime le `layout` QUE quand cet
  // ordre change (reclassement réel). Ainsi, déplier une attraction ne déclenche
  // aucune animation de position (plus d'effet d'étirement à l'ouverture).
  const orderKey = sortedWaitTimes.map((w) => w.rideId).join(",");

  // Frontière entre les favoris (épinglés en tête) et les attractions
  // classiques : on marque la 1re attraction non-favorite d'un séparateur plus
  // franc pour que les deux groupes se mélangent visuellement moins.
  const favCount = sortedWaitTimes.filter((w) =>
    isFavorite(favKey(w.rideId)),
  ).length;
  const hasFavBoundary = favCount > 0 && favCount < sortedWaitTimes.length;

  return (
    <div className="w-full text-sm">
      {/* En-tête (colonnes triables) — hors zone animée. */}
      <div
        className={cn(
          GRID_COLS,
          "h-10 border-b font-medium text-muted-foreground",
        )}
      >
        <div className="flex items-center gap-1.5">
          {/* Espace de la largeur de l'étoile (w-5) + même gap que les lignes,
              pour aligner "Attraction" avec les noms des attractions. */}
          <span className="w-5 shrink-0" aria-hidden />
          <button
            type="button"
            onClick={() => handleSort("name")}
            className={sortButtonClass}
          >
            {t("attraction")}
            {sortIndicator("name")}
          </button>
        </div>
        <button
          type="button"
          onClick={() => handleSort("wait")}
          className={sortButtonClass}
        >
          {t("waitTime")}
          {sortIndicator("wait")}
        </button>
        <button
          type="button"
          onClick={() => handleSort("status")}
          className={cn(
            sortButtonClass,
            "justify-self-end pe-0 sm:justify-self-start",
          )}
        >
          {t("status")}
          {sortIndicator("status")}
        </button>
      </div>

      {/* Corps : une ligne standby par attraction (+ files dépliées). Chaque
          attraction est un bloc `motion` animé en `layout` pour que le reclassement
          (tri, favoris épinglés, changements de temps) glisse au lieu de sauter. */}
      {sortedWaitTimes.length > 0 ? (
        sortedWaitTimes.map((waitTime, index) => {
          // Files triées : standby en premier, puis les autres par ordre alpha.
          const sortedQueues = [...waitTime.queues].sort((a, b) => {
            if (a.type === "standby") return -1;
            if (b.type === "standby") return 1;
            return a.type.localeCompare(b.type);
          });

          const standbyQueue = sortedQueues.find((q) => q.type === "standby");
          const otherQueues = sortedQueues.filter((q) => q.type !== "standby");
          const isExpanded = expandedRides.has(waitTime.rideId);
          const hasMultipleQueues = sortedQueues.length > 1;
          const fav = isFavorite(favKey(waitTime.rideId));
          const rideHistory = history[waitTime.rideId];

          return (
            <motion.div
              layout="position"
              layoutDependency={orderKey}
              key={waitTime.rideId}
              transition={{ type: "spring", stiffness: 320, damping: 36 }}
              // Séparateur entre attractions uniquement (pas de trait final en bas).
              // La 1re attraction classique après les favoris reçoit un trait plus
              // épais + un petit espace pour distinguer nettement les deux groupes.
              className={cn(
                index > 0 && "border-t",
                hasFavBoundary &&
                  index === favCount &&
                  "mt-2 border-t-2 border-border",
              )}
            >
              {/* Ligne standby (toujours affichée) */}
              {standbyQueue && (
                <div
                  className={cn(
                    GRID_COLS,
                    "group transition-colors duration-500",
                    changedRides.has(`${waitTime.rideId}-standby`) &&
                      "bg-accent",
                    hasMultipleQueues && "cursor-pointer hover:bg-accent/50",
                  )}
                  onClick={() =>
                    hasMultipleQueues && toggleExpand(waitTime.rideId)
                  }
                >
                  <div className="flex min-w-0 items-center gap-1.5 py-2 pe-2 font-medium wrap-break-word">
                    <FavoriteStar
                      active={fav}
                      onToggle={() => toggle(favKey(waitTime.rideId))}
                      label={fav ? tFav("remove") : tFav("add")}
                      className={cn(
                        "transition-opacity",
                        fav
                          ? "opacity-100"
                          : "opacity-40 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
                      )}
                    />
                    {/* Création d'une notification : uniquement connecté, et
                        depuis ici (popup attraction) — jamais depuis le profil. */}
                    {isAuthenticated && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setNotifTarget({
                            rideId: waitTime.rideId,
                            rideName: waitTime.rideName,
                          });
                        }}
                        aria-label={tNotif("createFor", {
                          ride: waitTime.rideName,
                        })}
                        className="shrink-0 text-muted-foreground opacity-40 transition-opacity hover:text-primary sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                      >
                        <Bell className="size-4" />
                      </button>
                    )}
                    <span className="min-w-0">
                      {hasMultipleQueues ? (
                        (() => {
                          const words = waitTime.rideName.trim().split(" ");
                          const lastWord = words.pop();
                          const beginning = words.join(" ");
                          return (
                            <>
                              {beginning}{" "}
                              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                {lastWord}
                                <ChevronRight
                                  className={cn(
                                    "size-3.5 transition-transform duration-200",
                                    isExpanded && "rotate-90",
                                  )}
                                />
                              </span>
                            </>
                          );
                        })()
                      ) : (
                        waitTime.rideName
                      )}
                    </span>
                  </div>
                  <div className="py-2">
                    {(() => {
                      const showTrend =
                        TRENDS_ENABLED &&
                        !parkClosed &&
                        !standbyQueue.timeSlot &&
                        standbyQueue.status === "open" &&
                        standbyQueue.waitTime >= 0;
                      if (standbyQueue.timeSlot) {
                        return getTimeSlotBadge(standbyQueue.timeSlot, is12Hour);
                      }
                      if (!showTrend) {
                        // Indispo / fermé : badge à sa largeur naturelle, pas de flèche.
                        return getWaitTimeBadge(
                          standbyQueue.waitTime,
                          unavailableLabel,
                        );
                      }
                      // Badge dans une boîte à largeur minimale (min-w-14) pour
                      // que les flèches d'une ligne à l'autre repartent du même x
                      // (colonne alignée). C'est un *minimum* : les badges 1–2
                      // chiffres collent la flèche, « +90 min » élargit juste sa
                      // boîte au lieu de déborder.
                      return (
                        <div className="flex items-center gap-1">
                          <span className="inline-flex min-w-14">
                            {getWaitTimeBadge(
                              standbyQueue.waitTime,
                              unavailableLabel,
                            )}
                          </span>
                          <WaitTrend
                            history={rideHistory ?? []}
                            current={standbyQueue.waitTime}
                          />
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex justify-end py-2 pe-0 sm:block">
                    {getStatusBadge(standbyQueue.status, statusLabels)}
                  </div>
                </div>
              )}

              {/* Files secondaires (visibles seulement si dépliées) */}
              {isExpanded &&
                otherQueues.map((queue) => (
                  <div
                    key={`${waitTime.rideId}-${queue.type}`}
                    className={cn(
                      GRID_COLS,
                      "border-t transition-colors duration-500",
                      changedRides.has(`${waitTime.rideId}-${queue.type}`) &&
                        "bg-accent",
                    )}
                  >
                    <div className="flex items-center gap-1 py-2 pe-2 ps-6 font-medium text-muted-foreground">
                      <CornerDownRight className="size-3.5" />
                      <span>{getQueueLabel(queue.type)}</span>
                      {QUEUE_TYPE_MAP[queue.type] &&
                        (() => {
                          const Icon = QUEUE_TYPE_MAP[queue.type].icon;
                          return <Icon className="size-3.5" />;
                        })()}
                    </div>
                    <div className="py-2">
                      {queue.timeSlot
                        ? getTimeSlotBadge(queue.timeSlot, is12Hour)
                        : getWaitTimeBadge(queue.waitTime, unavailableLabel)}
                    </div>
                    <div className="flex justify-end py-2 pe-0 sm:block">
                      {getStatusBadge(queue.status, statusLabels)}
                    </div>
                  </div>
                ))}
            </motion.div>
          );
        })
      ) : (
        <div className="py-4 text-center text-muted-foreground">
          {t("noWaitTimes")}
        </div>
      )}

      {/* Un seul dialog de création, piloté par la cloche de chaque ligne. */}
      <CreateNotificationDialog
        target={notifTarget}
        parkIdentifier={parkIdentifier}
        parkName={parkName}
        onOpenChange={(open) => {
          if (!open) setNotifTarget(null);
        }}
      />
    </div>
  );
}
