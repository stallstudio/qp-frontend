import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { getUserPrisma } from "@/lib/user-prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET : export RGPD (droit à la portabilité) de TOUTES les données de compte au
// format JSON, en pièce jointe téléchargeable. On n'inclut que des données
// utilisateur ; les clés cryptographiques des abonnements push sont volontairement
// omises (secrets d'appareil, sans intérêt pour l'utilisateur et sensibles).
export async function GET() {
  const { userId, response } = await requireUserId();
  if (!userId)
    return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getUserPrisma();

  const [user, preferences, favorites, alerts, alertHistory, showReminders, pushSubscriptions] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.userPreferences.findUnique({
        where: { userId },
        select: { locale: true, theme: true, timeFormat: true, createdAt: true },
      }),
      prisma.favorite.findMany({
        where: { userId },
        select: { type: true, key: true, createdAt: true },
      }),
      prisma.alert.findMany({
        where: { userId },
        select: {
          rideName: true,
          parkName: true,
          parkIdentifier: true,
          threshold: true,
          active: true,
          createdAt: true,
        },
      }),
      prisma.alertHistory.findMany({
        where: { userId },
        select: {
          rideName: true,
          parkIdentifier: true,
          threshold: true,
          actualWaitTime: true,
          sentAt: true,
        },
      }),
      prisma.showReminder.findMany({
        where: { userId },
        select: {
          showName: true,
          parkName: true,
          parkIdentifier: true,
          startTime: true,
          leadMinutes: true,
          sent: true,
          createdAt: true,
        },
      }),
      prisma.pushSubscription.findMany({
        where: { userId },
        select: { userAgent: true, createdAt: true },
      }),
    ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    account: user,
    preferences,
    favorites,
    alerts,
    alertHistory,
    showReminders,
    // Sans les clés de chiffrement : uniquement l'appareil + la date.
    pushDevices: pushSubscriptions,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="queue-park-data.json"',
    },
  });
}
