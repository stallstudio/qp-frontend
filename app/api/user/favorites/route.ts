import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { getUserPrisma } from "@/lib/user-prisma";
import { flattenFavorites, groupFavorites } from "@/lib/user-favorites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET : favoris du compte, au format { parks, rides }.
export async function GET() {
  const { userId, response } = await requireUserId();
  if (!userId) return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await getUserPrisma().favorite.findMany({
    where: { userId },
    select: { type: true, key: true },
  });
  return NextResponse.json(groupFavorites(rows));
}

// PUT : remplace l'intégralité des favoris par l'état fourni. Utilisé par le
// UserProvider pour pousser le localStorage (source de travail côté client) vers
// le compte quand l'utilisateur (dé)favorise quelque chose en étant connecté.
export async function PUT(request: NextRequest) {
  const { userId, response } = await requireUserId();
  if (!userId) return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const favorites = flattenFavorites(await request.json().catch(() => null));
  const prisma = getUserPrisma();

  await prisma.$transaction([
    prisma.favorite.deleteMany({ where: { userId } }),
    prisma.favorite.createMany({
      data: favorites.map((f) => ({ userId, type: f.type, key: f.key })),
    }),
  ]);

  return NextResponse.json(groupFavorites(favorites));
}
