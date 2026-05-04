"use client";

import { WaitTime } from "@/types/waitTime";
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
import {
  ChevronRight,
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

type WaitTimeTableProps = {
  waitTimes: WaitTime[];
  queueTypeLabels?: Record<string, string> | null;
};

export default function ParkWaitTimeTable({
  waitTimes,
  queueTypeLabels,
}: WaitTimeTableProps) {
  const t = useTranslations("waitTimeTable");
  const tStatus = useTranslations("attractionStatus");
  const { is12Hour } = useTimeFormat();
  const [expandedRides, setExpandedRides] = useState<Set<number>>(new Set());

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

  const sortedWaitTimes = useMemo(
    () =>
      [...waitTimes].sort((a, b) => {
        const statusOrder = { open: 0, down: 1, closed: 2, maintenance: 3 };

        // Get primary queue (standby or first available)
        const aQueue =
          a.queues.find((q) => q.type === "standby") || a.queues[0];
        const bQueue =
          b.queues.find((q) => q.type === "standby") || b.queues[0];

        if (!aQueue || !bQueue) return 0;

        const statusDiff =
          statusOrder[aQueue.status] - statusOrder[bQueue.status];

        if (statusDiff !== 0) return statusDiff;

        if (aQueue.waitTime !== bQueue.waitTime) {
          return bQueue.waitTime - aQueue.waitTime;
        }

        return a.rideName.localeCompare(b.rideName);
      }),
    [waitTimes],
  );

  return (
    <Table className="border-b">
      <TableHeader>
        <TableRow>
          <TableHead className="text-left w-4/6 ps-0">
            {t("attraction")}
          </TableHead>
          <TableHead className="text-left w-1/6">{t("waitTime")}</TableHead>
          <TableHead className="text-left w-1/6 pe-0">{t("status")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="w-full">
        {sortedWaitTimes.length > 0 ? (
          sortedWaitTimes.map((waitTime, index) => {
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

            const rows: React.ReactElement[] = [];

            // Always show standby queue
            if (standbyQueue) {
              rows.push(
                <TableRow
                  key={`${waitTime.rideId}-standby`}
                  className={`max-w-full transition-colors duration-500 ${changedRides.has(`${waitTime.rideId}-standby`)
                    ? "bg-accent"
                    : ""
                    } ${hasMultipleQueues ? "cursor-pointer hover:bg-accent/50" : ""}`}
                  onClick={() =>
                    hasMultipleQueues && toggleExpand(waitTime.rideId)
                  }
                >
                  <TableCell className="ps-0 font-medium w-4/6 whitespace-normal wrap-break-word">
                    {hasMultipleQueues ? (
                      <>
                        {(() => {
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
                        })()}
                      </>
                    ) : (
                      waitTime.rideName
                    )}
                  </TableCell>
                  <TableCell className="text-left w-1/6 overflow-hidden">
                    {standbyQueue.timeSlot
                      ? getTimeSlotBadge(standbyQueue.timeSlot, is12Hour)
                      : getWaitTimeBadge(standbyQueue.waitTime, unavailableLabel)}
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
                      <div className="flex items-center gap-1 text-muted-foreground">
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
