import { TimeSlot, WaitTimeStatus } from "@/types/waitTime";
import { DateTime } from "luxon";
import { getLuxonFormat } from "@/lib/utils";
import type { ReactNode } from "react";

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

function getWaitTimeBadge(
  waitTime: number,
  unavailableLabel: ReactNode = "Unavailable",
) {
  const colorClass = getWaitTimeColorClass(waitTime);

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${colorClass}`}
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
      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-sky-100 text-sky-700 whitespace-nowrap"
    >
      {formatHHmm(slot.start, is12Hour)}
      {"-"}
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

/**
 * Pastille d'état.
 *
 * `dense` resserre le rembourrage sur MOBILE uniquement (`px-1.5`/`gap-1` au
 * lieu de `px-2`/`gap-1.5`). Réservé aux listes en colonnes serrées : dans le
 * tableau des temps d'attente, « Maintenance » — le plus long des quatre
 * libellés — remplissait exactement les 6rem de sa colonne et venait coller la
 * pastille « Indispo » d'à côté. La cellule étant en `justify-end`, les ~8 px
 * rendus ici se transforment directement en écart, sans rien retirer au nom de
 * l'attraction.
 *
 * ⚠️ Hors de ce cas, garder le rembourrage par défaut : `ParkStatusBadge`
 * (`name-status.tsx`) recopie ce style à la main pour l'état « ouvert », les
 * deux se désaligneraient.
 */
function getStatusBadge(
  status: WaitTimeStatus,
  labels?: Record<string, string>,
  dense = false,
) {
  const colorClass = getStatusColorClass(status);
  const dotColorClass = getStatusDotColorClass(status);
  const spacingClass = dense
    ? "gap-1 px-1.5 sm:gap-1.5 sm:px-2"
    : "gap-1.5 px-2";

  return (
    <span
      className={`inline-flex items-center ${spacingClass} py-1 rounded-full text-xs font-medium whitespace-nowrap ${colorClass}`}
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
