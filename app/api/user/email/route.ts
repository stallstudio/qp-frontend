import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { getUserPrisma } from "@/lib/user-prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Validation e-mail minimale (même esprit que le formulaire de connexion).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST : change l'adresse e-mail du compte (RGPD — droit de rectification).
// L'e-mail étant l'identité de connexion (magic link), le client DÉCONNECTE
// l'utilisateur après succès pour qu'il se ré-authentifie avec la nouvelle
// adresse. On repasse `emailVerified` à null (nouvelle adresse non vérifiée).
export async function POST(request: NextRequest) {
  const { userId, response } = await requireUserId();
  if (!userId)
    return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
  } | null;
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const prisma = getUserPrisma();

  // Inchangée : rien à faire (évite un 409 contre soi-même).
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (current?.email?.toLowerCase() === email) {
    return NextResponse.json({ success: true, unchanged: true });
  }

  // Déjà utilisée par un AUTRE compte → conflit.
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing && existing.id !== userId) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { email, emailVerified: null },
  });

  return NextResponse.json({ success: true });
}
