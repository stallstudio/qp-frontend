import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { getUserPrisma } from "@/lib/user-prisma";
import { getPrisma } from "@/lib/prisma";
import { toAlertHistoryDTO } from "@/lib/user-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rétention de l'historique côté affichage : on ne remonte que les 30 derniers
// jours (au-delà, c'est masqué ; un texte l'indique dans l'UI).
const HISTORY_MAX_AGE_DAYS = 30;

// GET : historique des alertes envoyées (lecture seule pour l'utilisateur), les
// plus récentes d'abord. Rempli par le moteur (/api/cron/alerts).
export async function GET() {
  const { userId, response } = await requireUserId();
  if (!userId) return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cutoff = new Date(
    Date.now() - HISTORY_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  );
  const rows = await getUserPrisma().alertHistory.findMany({
    where: { userId, sentAt: { gte: cutoff } },
    orderBy: { sentAt: "desc" },
    take: 100,
  });

  // L'historique ne stocke que l'identifiant du parc : on résout les noms
  // affichables depuis la base principale (une requête pour tous les parcs cités).
  const identifiers = [...new Set(rows.map((r) => r.parkIdentifier))];
  const parks = identifiers.length
    ? await getPrisma().park.findMany({
        where: { identifier: { in: identifiers } },
        select: { identifier: true, name: true },
      })
    : [];
  const parkNameByIdentifier = new Map(parks.map((p) => [p.identifier, p.name]));

  return NextResponse.json(
    rows.map((r) => toAlertHistoryDTO(r, parkNameByIdentifier.get(r.parkIdentifier))),
  );
}
