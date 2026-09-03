import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { getUserPrisma } from "@/lib/user-prisma";
import { toAlertDTO } from "@/lib/user-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_THRESHOLD = 1;
const MAX_THRESHOLD = 600;

// PATCH : activer / désactiver une alerte (et, optionnellement, ajuster le seuil).
// Depuis le profil on peut (dé)activer ET modifier le seuil.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId, response } = await requireUserId();
  if (!userId) return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const data: {
    active?: boolean;
    threshold?: number;
    armed?: boolean;
    activeDate?: Date;
  } = {};
  if (typeof body.active === "boolean") {
    data.active = body.active;
    // Réactivation depuis le profil : on réarme le moteur et on recale le jour de
    // validité sur aujourd'hui (une alerte ne vaut que pour la journée en cours).
    if (body.active) {
      data.armed = true;
      data.activeDate = new Date();
    }
  }
  if (body.threshold !== undefined) {
    const threshold = Number(body.threshold);
    if (
      !Number.isInteger(threshold) ||
      threshold < MIN_THRESHOLD ||
      threshold > MAX_THRESHOLD
    ) {
      return NextResponse.json({ error: "Invalid threshold" }, { status: 400 });
    }
    data.threshold = threshold;
    // Nouveau seuil → on réarme pour qu'il puisse déclencher (même si l'alerte
    // avait déjà été envoyée avec l'ancien seuil).
    data.armed = true;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // updateMany scoping par userId : on ne peut modifier que ses propres alertes.
  const result = await getUserPrisma().alert.updateMany({
    where: { id, userId },
    data,
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const alert = await getUserPrisma().alert.findUnique({
    where: { id },
  });
  return NextResponse.json(alert ? toAlertDTO(alert) : null);
}

// DELETE : supprime définitivement une alerte. L'historique déjà envoyé est
// conservé (alertId passe à NULL via onDelete: SetNull).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId, response } = await requireUserId();
  if (!userId) return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await getUserPrisma().alert.deleteMany({
    where: { id, userId },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
