"use client";

import { WaitTime, QueueTime } from "@/types/waitTime";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
  TableHead,
} from "@/components/ui/table";
import { getStatusBadge, getTimeSlotBadge, getWaitTimeBadge } from "@/lib/badge";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useWaitTimeChanges } from "@/hooks/useWaitTimeChanges";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { useFavorites } from "@/hooks/useFavorites";
import FavoriteStar from "@/components/ui/favorite-star";
import WaitTrend from "@/components/parks/wait-trend";
import {
  ChevronRight,
  ChevronUp,
  ChevronDown,
  User,
  Clock,
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
  history?: Record<number, number[]>;
};

const STATUS_ORDER = { open: 0, down: 1, closed: 2, maintenance: 3 } as const;

function getPrimaryQueue(wt: WaitTime): QueueTime | undefined {
  return wt.queues.find((q) => q.type === "standby") || wt.queues[0];
}

export default function ParkWaitTimeTable({
  waitTimes,
  queueTypeLabels,
  parkIdentifier,
  history = {},
}: WaitTimeTableProps) {
  const t = useTranslations("waitTimeTable");
  const tStatus = useTranslations("attractionStatus");
  const tFav = useTranslations("favorites");
  const { is12Hour } = useTimeFormat();
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
  const unavailableLabel = tStatus("unavailable");

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

  return (
    <Table className="border-b">
      <TableHeader>
        <TableRow>
          <TableHead className="text-left w-4/6 ps-0">
            {/* Espace de la largeur de l'étoile (w-5) + même gap que les lignes,
                pour aligner "Attraction" avec les noms des attractions. */}
            <div className="flex items-center gap-1.5">
              <span className="w-5 shrink-0" aria-hidden />
              <button
                type="button"
                onClick={() => handleSort("name")}
                className="inline-flex items-center gap-1 cursor-pointer select-none hover:text-foreground transition-colors"
              >
                {t("attraction")}
                {sortIndicator("name")}
              </button>
            </div>
          </TableHead>
          <TableHead className="text-left w-1/6">
            <button
              type="button"
              onClick={() => handleSort("wait")}
              className="inline-flex items-center gap-1 cursor-pointer select-none hover:text-foreground transition-colors"
            >
              {t("waitTime")}
              {sortIndicator("wait")}
            </button>
          </TableHead>
          <TableHead className="text-left w-1/6 pe-0">
            <button
              type="button"
              onClick={() => handleSort("status")}
              className="inline-flex items-center gap-1 cursor-pointer select-none hover:text-foreground transition-colors"
            >
              {t("status")}
              {sortIndicator("status")}
            </button>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="w-full">
        {sortedWaitTimes.length > 0 ? (
          sortedWaitTimes.map((waitTime) => {
            // Sort queues: standby first, then others alphabetically
            const sortedQueues = [...waitTime.queues].sort((a, b) => {
              if (a.type === "standby") return -1;
              if (b.type === "standby") return 1;
              return a.type.localeCompare(b.type);
            });

            const standbyQueue = sortedQueues.find((q) => q.type === "standby");
            const otherQueues = sortedQueues.filter(
              (q) => q.type !== "standby",
            );
            const isExpanded = expandedRides.has(waitTime.rideId);
            const hasMultipleQueues = sortedQueues.length > 1;
            const fav = isFavorite(favKey(waitTime.rideId));
            const rideHistory = history[waitTime.rideId];

            const rows: React.ReactElement[] = [];

            // Always show standby queue
            if (standbyQueue) {
              rows.push(
                <TableRow
                  key={`${waitTime.rideId}-standby`}
                  className={`group max-w-full transition-colors duration-500 ${changedRides.has(`${waitTime.rideId}-standby`)
                    ? "bg-accent"
                    : ""
                    } ${hasMultipleQueues ? "cursor-pointer hover:bg-accent/50" : ""}`}
                  onClick={() =>
                    hasMultipleQueues && toggleExpand(waitTime.rideId)
                  }
                >
                  <TableCell className="ps-0 font-medium w-4/6 whitespace-normal wrap-break-word">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <FavoriteStar
                        active={fav}
                        onToggle={() => toggle(favKey(waitTime.rideId))}
                        label={fav ? tFav("remove") : tFav("add")}
                        className={`transition-opacity ${
                          fav
                            ? "opacity-100"
                            : "opacity-40 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                        }`}
                      />
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
                                    className={`size-3.5 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""
                                      }`}
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
                  </TableCell>
                  <TableCell className="text-left w-1/6 overflow-hidden">
                    {(() => {
                      const showTrend =
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
                      // Slot de largeur fixe pour que toutes les flèches soient alignées.
                      return (
                        <div className="flex items-center gap-1">
                          <span className="inline-flex w-16 shrink-0">
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
                  </TableCell>
                  <TableCell className="text-left w-1/6 overflow-hidden pe-0">
                    {getStatusBadge(standbyQueue.status, statusLabels)}
                  </TableCell>
                </TableRow>,
              );
            }

            // Show other queues only if expanded
            if (isExpanded && otherQueues.length > 0) {
              otherQueues.forEach((queue) => {
                rows.push(
                  <TableRow
                    key={`${waitTime.rideId}-${queue.type}`}
                    className={`max-w-full transition-colors duration-500 ${changedRides.has(`${waitTime.rideId}-${queue.type}`)
                      ? "bg-accent"
                      : ""
                      }`}
                  >
                    <TableCell className="ps-0 font-medium w-4/6 whitespace-normal wrap-break-word">
                      <div className="flex items-center gap-1 text-muted-foreground ps-6">
                        <CornerDownRight className="size-3.5" />
                        <span>{getQueueLabel(queue.type)}</span>
                        {QUEUE_TYPE_MAP[queue.type] &&
                          (() => {
                            const Icon = QUEUE_TYPE_MAP[queue.type].icon;
                            return <Icon className="size-3.5" />;
                          })()}
                      </div>
                    </TableCell>
                    <TableCell className="text-left w-1/6 overflow-hidden">
                      {queue.timeSlot
                        ? getTimeSlotBadge(queue.timeSlot, is12Hour)
                        : getWaitTimeBadge(queue.waitTime, unavailableLabel)}
                    </TableCell>
                    <TableCell className="text-left w-1/6 overflow-hidden pe-0">
                      {getStatusBadge(queue.status, statusLabels)}
                    </TableCell>
                  </TableRow>,
                );
              });
            }

            return rows;
          })
        ) : (
          <TableRow>
            <TableCell
              colSpan={3}
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
