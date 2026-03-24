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
import { getStatusBadge, getWaitTimeBadge } from "@/lib/badge";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useWaitTimeChanges } from "@/hooks/useWaitTimeChanges";
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
  const [expandedRides, setExpandedRides] = useState<Set<string>>(new Set());

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

  const toggleExpand = (rideName: string) => {
    setExpandedRides((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rideName)) {
        newSet.delete(rideName);
      } else {
        newSet.add(rideName);
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
          <TableHead className="text-left w-4/6">{t("attraction")}</TableHead>
          <TableHead className="text-left w-1/6">{t("waitTime")}</TableHead>
          <TableHead className="text-left w-1/6">{t("status")}</TableHead>
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
            const isExpanded = expandedRides.has(waitTime.rideName);
            const hasMultipleQueues = sortedQueues.length > 1;

            const rows = [];

            // Always show standby queue
            if (standbyQueue) {
              rows.push(
                <TableRow
                  key={`${index}-standby`}
                  className={`max-w-full transition-colors duration-500 ${
                    changedRides.has(`${waitTime.rideName}-standby`)
                      ? "bg-accent"
                      : ""
                  } ${hasMultipleQueues ? "cursor-pointer hover:bg-accent/50" : ""}`}
                  onClick={() =>
                    hasMultipleQueues && toggleExpand(waitTime.rideName)
                  }
                >
                  <TableCell className="font-medium w-4/6 whitespace-normal wrap-break-word">
                    <div className="flex items-center gap-2">
                      {waitTime.rideName}
                      {hasMultipleQueues && (
                        <ChevronRight
                          className={`h-4 w-4 transition-transform duration-200 ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-left w-1/6 overflow-hidden">
                    {getWaitTimeBadge(standbyQueue.waitTime)}
                  </TableCell>
                  <TableCell className="text-left w-1/6 overflow-hidden">
                    {getStatusBadge(standbyQueue.status)}
                  </TableCell>
                </TableRow>,
              );
            }

            // Show other queues only if expanded
            if (isExpanded && otherQueues.length > 0) {
              otherQueues.forEach((queue) => {
                rows.push(
                  <TableRow
                    key={`${index}-${queue.type}`}
                    className={`max-w-full transition-colors duration-500 ${
                      changedRides.has(`${waitTime.rideName}-${queue.type}`)
                        ? "bg-accent"
                        : ""
                    }`}
                  >
                    <TableCell className="font-medium w-4/6 whitespace-normal wrap-break-word">
                      <div className="flex items-center gap-2 text-muted-foreground">
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
                      {getWaitTimeBadge(queue.waitTime)}
                    </TableCell>
                    <TableCell className="text-left w-1/6 overflow-hidden">
                      {getStatusBadge(queue.status)}
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
