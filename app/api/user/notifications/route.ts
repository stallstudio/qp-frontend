import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { getUserPrisma } from "@/lib/user-prisma";
import { toNotificationDTO } from "@/lib/user-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_THRESHOLD = 1;
const MAX_THRESHOLD = 600;

// GET : toutes les notifications de l'utilisateur (actives et désactivées),
// les plus récentes d'abord.
export async function GET() {
  const { userId, response } = await requireUserId();
  if (!userId) return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await getUserPrisma().notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(rows.map(toNotificationDTO));
}

// POST : crée (ou met à jour le seuil d') une notification pour une attraction.
// Appelé UNIQUEMENT depuis le popup d'une attraction — jamais depuis le profil.
// Une seule notification par attraction et par utilisateur (@@unique userId+rideId) :
// re-soumettre réactive et met à jour le seuil.
export async function POST(request: NextRequest) {
  const { userId, response } = await requireUserId();
  if (!userId) return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const rideId = Number(body.rideId);
  const threshold = Number(body.threshold);
  const parkIdentifier = body.parkIdentifier;
  const rideName = body.rideName;
  const parkName = body.parkName;

  if (
    !Number.isInteger(rideId) ||
    !Number.isInteger(threshold) ||
    threshold < MIN_THRESHOLD ||
    threshold > MAX_THRESHOLD ||
    typeof parkIdentifier !== "string" ||
    typeof rideName !== "string" ||
    typeof parkName !== "string"
  ) {
    return NextResponse.json(
      { error: "Invalid notification payload" },
      { status: 400 },
    );
  }

  const notification = await getUserPrisma().notification.upsert({
    where: { userId_rideId: { userId, rideId } },
    update: { threshold, active: true, rideName, parkName, parkIdentifier },
    create: {
      userId,
      rideId,
      parkIdentifier,
      rideName,
      parkName,
      threshold,
      active: true,
    },
  });

  return NextResponse.json(toNotificationDTO(notification), { status: 201 });
}
