import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { getUserPrisma } from "@/lib/user-prisma";
import { toShowReminderHistoryDTO } from "@/lib/user-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fenêtre d'AFFICHAGE (pas de purge) : on ne montre que les 30 derniers jours.
// La table `ShowReminderHistory` conserve TOUT en base ; seul le front est borné.
const HISTORY_MAX_AGE_DAYS = 30;

// GET : historique des rappels de spectacles ENVOYÉS (lecture seule), les plus
// récents d'abord. Lit le journal permanent `ShowReminderHistory` : il survit à
// l'édition / la suppression d'un rappel (pendant de l'historique des alertes).
export async function GET() {
  const { userId, response } = await requireUserId();
  if (!userId)
    return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cutoff = new Date(
    Date.now() - HISTORY_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  );
  const rows = await getUserPrisma().showReminderHistory.findMany({
    where: { userId, sentAt: { gte: cutoff } },
    orderBy: { sentAt: "desc" },
    take: 100,
  });

  return NextResponse.json(rows.map(toShowReminderHistoryDTO));
}
