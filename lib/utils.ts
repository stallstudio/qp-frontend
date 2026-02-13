import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { DateTime } from "luxon";
import { OpeningHour } from "@/types/openingHour";
import { ParkGroup, ParkStatus } from "@/types/park";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Get current time from a specified timezone
export function getLocalTime(timezone: string) {
  return DateTime.now().setZone(timezone).toFormat("HH:mm");
}

export function getParkStatus(openingHours: OpeningHour[]): ParkStatus {
  const now = DateTime.now().setZone("UTC");

  if (openingHours.length === 0) {
    return "unknown";
  }
  for (const hour of openingHours) {
    if (!hour.openTime && !hour.closeTime) {
      return "closed";
    }

    const openTime = DateTime.fromISO(hour.openTime, { zone: "UTC" });
    const closeTime = DateTime.fromISO(hour.closeTime, { zone: "UTC" });

    if (now >= openTime && now < closeTime) {
      return "open";
    }
  }

  return "closed";
}

export const getGroupName = (groupId: number, groups: ParkGroup[]) => {
  const group = groups.find((g) => g.id === groupId);
  return group ? group.name : "Unknown Group";
};

export function getCountryName(code: string): string {
  if (!code) return "";

  const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
  return regionNames.of(code.toUpperCase()) ?? code;
}
