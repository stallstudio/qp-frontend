import { getUserPrisma } from "@/lib/user-prisma";
import {
  DEFAULT_PREFERENCES,
  timeFormatFromDb,
  type UserPreferences,
} from "@/lib/user-preferences";
import type {
  AlertDTO,
  AlertHistoryDTO,
  ShowReminderDTO,
  ShowReminderHistoryDTO,
} from "@/types/user";
import type {
  Alert,
  AlertHistory,
  ShowReminder,
  ShowReminderHistory,
} from "@/lib/generated/user-client";

// Accès aux données de compte, partagé par les routes /api/user/*.

// Lit les préférences du compte, en créant la ligne par défaut au premier accès
// (upsert). `initialized` vaut false tant que l'utilisateur n'a jamais enregistré
// de préférence (utilisé pour la fusion au premier login).
export async function getPreferences(
  userId: string,
): Promise<{ preferences: UserPreferences; initialized: boolean }> {
  const prisma = getUserPrisma();
  const row = await prisma.userPreferences.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      locale: DEFAULT_PREFERENCES.locale,
      theme: DEFAULT_PREFERENCES.theme,
      timeFormat: "h24",
      temperatureUnit: DEFAULT_PREFERENCES.temperatureUnit,
    },
  });
  return {
    preferences: {
      locale: row.locale,
      theme: row.theme,
      timeFormat: timeFormatFromDb(row.timeFormat),
      temperatureUnit: row.temperatureUnit,
    },
    initialized: row.initialized,
  };
}

export function toAlertDTO(a: Alert): AlertDTO {
  return {
    id: a.id,
    rideId: a.rideId,
    parkIdentifier: a.parkIdentifier,
    rideName: a.rideName,
    parkName: a.parkName,
    threshold: a.threshold,
    active: a.active,
    createdAt: a.createdAt.toISOString(),
  };
}

export function toShowReminderDTO(r: ShowReminder): ShowReminderDTO {
  return {
    id: r.id,
    parkIdentifier: r.parkIdentifier,
    parkName: r.parkName,
    showName: r.showName,
    startTime: r.startTime.toISOString(),
    leadMinutes: r.leadMinutes,
  };
}

// Entrée du journal permanent des rappels de spectacles envoyés.
export function toShowReminderHistoryDTO(
  h: ShowReminderHistory,
): ShowReminderHistoryDTO {
  return {
    id: h.id,
    parkIdentifier: h.parkIdentifier,
    parkName: h.parkName,
    showName: h.showName,
    startTime: h.startTime.toISOString(),
    leadMinutes: h.leadMinutes,
    sentAt: h.sentAt.toISOString(),
  };
}

export function toAlertHistoryDTO(
  h: AlertHistory,
  parkName?: string,
): AlertHistoryDTO {
  return {
    id: h.id,
    rideId: h.rideId,
    parkIdentifier: h.parkIdentifier,
    rideName: h.rideName,
    parkName: parkName ?? h.parkIdentifier,
    threshold: h.threshold,
    actualWaitTime: h.actualWaitTime,
    sentAt: h.sentAt.toISOString(),
  };
}
