import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { getUserPrisma } from "@/lib/user-prisma";
import { toNotificationDTO } from "@/lib/user-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_THRESHOLD = 1;
const MAX_THRESHOLD = 600;

// PATCH : activer / désactiver une notification (et, optionnellement, ajuster le
// seuil). Depuis le profil on ne fait qu'activer/désactiver ; la modification de
// seuil reste possible pour rester évolutif.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId, response } = await requireUserId();
  if (!userId) return response;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const data: { active?: boolean; threshold?: number } = {};
  if (typeof body.active === "boolean") data.active = body.active;
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
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // updateMany scoping par userId : on ne peut modifier que ses propres notifs.
  const result = await getUserPrisma().notification.updateMany({
    where: { id, userId },
    data,
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const notification = await getUserPrisma().notification.findUnique({
    where: { id },
  });
  return NextResponse.json(notification ? toNotificationDTO(notification) : null);
}

// DELETE : supprime définitivement une notification. L'historique déjà envoyé
// est conservé (notificationId passe à NULL via onDelete: SetNull).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId, response } = await requireUserId();
  if (!userId) return response;

  const { id } = await params;
  const result = await getUserPrisma().notification.deleteMany({
    where: { id, userId },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
