import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { getUserPrisma } from "@/lib/user-prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// La colonne accepte 255 caractères, mais le nom est repris tel quel dans
// l'interface (pastille du compte, « Content de vous revoir ») : au-delà, il
// déborderait partout. On le plafonne donc ici ET côté champ de saisie.
export const MAX_NAME_LENGTH = 60;

// PATCH : change le nom affiché du compte (droit de rectification). Un nom vide
// remet la colonne à NULL — l'interface retombe alors sur l'e-mail.
export async function PATCH(request: NextRequest) {
  const { userId, response } = await requireUserId();
  if (!userId)
    return (
      response || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );

  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
  } | null;
  if (typeof body?.name !== "string") {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  // Caractères de contrôle retirés et espaces normalisés : le nom est affiché
  // tel quel, il ne doit contenir ni saut de ligne ni longue suite d'espaces.
  const name = body.name
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: "Name too long" }, { status: 400 });
  }

  const prisma = getUserPrisma();
  const user = await prisma.user.update({
    where: { id: userId },
    data: { name: name || null },
    select: { name: true },
  });

  return NextResponse.json({ name: user.name });
}
