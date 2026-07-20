import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { getUserPrisma } from "@/lib/user-prisma";
import { flattenFavorites, groupFavorites } from "@/lib/user-favorites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST : fusionne (union) les favoris locaux fournis avec ceux déjà en compte,
// sans rien supprimer. Appelé une fois à la connexion pour ne perdre aucun favori
// ajouté hors-ligne. Renvoie l'union, qui redevient la source côté client.
export async function POST(request: NextRequest) {
  const { userId, response } = await requireUserId();
  if (!userId) return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const incoming = flattenFavorites(await request.json().catch(() => null));
  const prisma = getUserPrisma();

  if (incoming.length > 0) {
    await prisma.favorite.createMany({
      data: incoming.map((f) => ({ userId, type: f.type, key: f.key })),
      skipDuplicates: true,
    });
  }

  const rows = await prisma.favorite.findMany({
    where: { userId },
    select: { type: true, key: true },
  });
  return NextResponse.json(groupFavorites(rows));
}
