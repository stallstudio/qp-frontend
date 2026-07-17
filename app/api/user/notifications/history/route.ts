import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { getUserPrisma } from "@/lib/user-prisma";
import { toNotificationHistoryDTO } from "@/lib/user-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET : historique des notifications envoyées (lecture seule pour l'utilisateur),
// les plus récentes d'abord. Rempli par le futur moteur de vérification des temps.
export async function GET() {
  const { userId, response } = await requireUserId();
  if (!userId) return response;

  const rows = await getUserPrisma().notificationHistory.findMany({
    where: { userId },
    orderBy: { sentAt: "desc" },
    take: 100,
  });
  return NextResponse.json(rows.map(toNotificationHistoryDTO));
}
