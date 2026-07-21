import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { getUserPrisma } from "@/lib/user-prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE : suppression définitive du compte (RGPD — droit à l'effacement). Le
// `onDelete: Cascade` du schéma emporte préférences, favoris, alertes, historique,
// rappels de spectacles, sessions et comptes liés. On exige la confirmation par
// l'e-mail du compte (défense contre une suppression accidentelle / CSRF).
export async function DELETE(request: NextRequest) {
  const { userId, response } = await requireUserId();
  if (!userId)
    return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    confirm?: unknown;
  } | null;
  const confirm =
    typeof body?.confirm === "string" ? body.confirm.trim().toLowerCase() : "";

  const prisma = getUserPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  // La confirmation doit correspondre à l'e-mail du compte.
  if (!user?.email || confirm !== user.email.toLowerCase()) {
    return NextResponse.json(
      { error: "Confirmation mismatch" },
      { status: 400 },
    );
  }

  await prisma.user.delete({ where: { id: userId } });

  return NextResponse.json({ success: true });
}
