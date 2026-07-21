import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { getUserPrisma } from "@/lib/user-prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE : supprime un rappel de spectacle. Scoping par userId : on ne peut
// supprimer que ses propres rappels.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId, response } = await requireUserId();
  if (!userId)
    return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await getUserPrisma().showReminder.deleteMany({
    where: { id, userId },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
