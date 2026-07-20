import { getUserPrisma } from "@/lib/user-prisma";
import {
  DEFAULT_PREFERENCES,
  timeFormatFromDb,
  type UserPreferences,
} from "@/lib/user-preferences";
import type { AlertDTO, AlertHistoryDTO } from "@/types/user";
import type { Alert, AlertHistory } from "@/lib/generated/user-client";

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
    },
  });
  return {
    preferences: {
      locale: row.locale,
      theme: row.theme,
      timeFormat: timeFormatFromDb(row.timeFormat),
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

export function toAlertHistoryDTO(h: AlertHistory): AlertHistoryDTO {
  return {
    id: h.id,
    rideId: h.rideId,
    parkIdentifier: h.parkIdentifier,
    rideName: h.rideName,
    threshold: h.threshold,
    actualWaitTime: h.actualWaitTime,
    sentAt: h.sentAt.toISOString(),
  };
}
