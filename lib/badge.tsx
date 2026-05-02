import { TimeSlot, WaitTimeStatus } from "@/types/waitTime";
import { DateTime } from "luxon";
import { getLuxonFormat } from "@/lib/utils";

function getWaitTimeColorClass(waitTime: number): string {
  if (waitTime < 0) {
    return "bg-gray-200 text-gray-700";
  }
  if (waitTime <= 20) {
    return "bg-green-100 text-green-700";
  }
  if (waitTime <= 40) {
    return "bg-orange-100 text-orange-700";
  }
  return "bg-red-100 text-red-700";
}

function getWaitTimeBadge(waitTime: number, unavailableLabel: string = "Unavailable") {
  const colorClass = getWaitTimeColorClass(waitTime);

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}
    >
      {waitTime === -1
        ? unavailableLabel
        : waitTime === 91
          ? "+90 min"
          : `${waitTime} min`}
    </span>
  );
}

function formatHHmm(hhmm: string, is12Hour: boolean): string {
  const parsed = DateTime.fromFormat(hhmm, "HH:mm");
  if (!parsed.isValid) return hhmm;
  return parsed.toFormat(getLuxonFormat(is12Hour));
}

function getTimeSlotBadge(slot: TimeSlot, is12Hour: boolean) {
  return (
    <span
      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 whitespace-nowrap"
    >
      {formatHHmm(slot.start, is12Hour)}
      {" – "}
      {formatHHmm(slot.end, is12Hour)}
    </span>
  );
}

function getStatusColorClass(status: WaitTimeStatus) {
  if (status === "open") {
    return "bg-green-100 text-green-700";
  }
  if (status === "closed") {
    return "bg-red-100 text-red-700";
  }
  if (status === "down") {
    return "bg-orange-100 text-orange-700";
  }
  if (status === "maintenance") {
    return "bg-red-100 text-red-700";
  }
}

function getStatusDotColorClass(status: WaitTimeStatus) {
  if (status === "open") {
    return "bg-green-400";
  }
  if (status === "closed") {
    return "bg-red-400";
  }
  if (status === "down") {
    return "bg-orange-300";
  }
  if (status === "maintenance") {
    return "bg-red-400";
  }
}

function getStatusLabel(status: WaitTimeStatus, labels?: Record<string, string>) {
  if (labels && labels[status]) {
    return labels[status];
  }
  if (status === "open") {
    return "Open";
  }
  if (status === "closed") {
    return "Closed";
  }
  if (status === "down") {
    return "Down";
  }
  if (status === "maintenance") {
    return "Maintenance";
  }
}

function getStatusBadge(status: WaitTimeStatus, labels?: Record<string, string>) {
  const colorClass = getStatusColorClass(status);
  const dotColorClass = getStatusDotColorClass(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}
    >
      <div className={`w-2 h-2 ${dotColorClass} rounded-full`}></div>
      {getStatusLabel(status, labels)}
    </span>
  );
}

function getParkStatusDot(
  status: "open" | "closed" | "unknown",
  size: "default" | "sm" = "default",
  className?: string,
) {
  const sizeClass = size === "default" ? "w-2 h-2" : "w-1.5 h-1.5";
  if (status === "open") {
    return (
      <span
        className={`${sizeClass} bg-green-500 rounded-full relative ${className || ""}`}
      >
        <span className="absolute inset-0 bg-green-500 rounded-full animate-ping"></span>
      </span>
    );
  }
  if (status === "closed") {
    return (
      <span
        className={`${sizeClass} bg-red-500 rounded-full ${className || ""}`}
      ></span>
    );
  }

  return null;
}

export { getWaitTimeBadge, getTimeSlotBadge, getStatusBadge, getParkStatusDot };
