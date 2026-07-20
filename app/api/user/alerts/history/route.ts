import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { getUserPrisma } from "@/lib/user-prisma";
import { toAlertHistoryDTO } from "@/lib/user-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET : historique des alertes envoyées (lecture seule pour l'utilisateur), les
// plus récentes d'abord. Rempli par le moteur (/api/cron/alerts).
export async function GET() {
  const { userId, response } = await requireUserId();
  if (!userId) return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await getUserPrisma().alertHistory.findMany({
    where: { userId },
    orderBy: { sentAt: "desc" },
    take: 100,
  });
  return NextResponse.json(rows.map(toAlertHistoryDTO));
}
