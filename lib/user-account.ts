import { getUserPrisma } from "@/lib/user-prisma";
import {
  DEFAULT_PREFERENCES,
  timeFormatFromDb,
  type UserPreferences,
} from "@/lib/user-preferences";
import type { NotificationDTO, NotificationHistoryDTO } from "@/types/user";
import type { Notification, NotificationHistory } from "@/lib/generated/user-client";

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

export function toNotificationDTO(n: Notification): NotificationDTO {
  return {
    id: n.id,
    rideId: n.rideId,
    parkIdentifier: n.parkIdentifier,
    rideName: n.rideName,
    parkName: n.parkName,
    threshold: n.threshold,
    active: n.active,
    createdAt: n.createdAt.toISOString(),
  };
}

export function toNotificationHistoryDTO(
  h: NotificationHistory,
): NotificationHistoryDTO {
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
