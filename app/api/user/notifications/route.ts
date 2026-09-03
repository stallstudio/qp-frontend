import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { getUserPrisma } from "@/lib/user-prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE : remise à zéro du système d'alertes de l'utilisateur — alertes de
// temps d'attente et rappels de spectacles EN COURS, plus les deux journaux de
// notifications reçues. Le compte, les préférences et les favoris ne sont pas
// touchés (pour ça, voir /api/user/account).
//
// Les quatre suppressions passent par UNE transaction : à moitié effacé, l'état
// serait incohérent (un historique sans ses alertes, ou l'inverse), et
// l'utilisateur n'a aucun moyen de relancer la partie manquante.
export async function DELETE() {
  const { userId, response } = await requireUserId();
  if (!userId)
    return response ||
      NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getUserPrisma();

  const [alerts, alertHistory, reminders, reminderHistory] =
    await prisma.$transaction([
      prisma.alert.deleteMany({ where: { userId } }),
      prisma.alertHistory.deleteMany({ where: { userId } }),
      prisma.showReminder.deleteMany({ where: { userId } }),
      prisma.showReminderHistory.deleteMany({ where: { userId } }),
    ]);

  return NextResponse.json({
    alerts: alerts.count,
    alertHistory: alertHistory.count,
    reminders: reminders.count,
    reminderHistory: reminderHistory.count,
  });
}
