import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { getUserPrisma } from "@/lib/user-prisma";
import { groupFavorites, NAMESPACE_TO_TYPE } from "@/lib/user-favorites";
import { FAV_LIMITS, type FavNamespace } from "@/lib/favorites-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET : favoris du compte, au format { parks, rides, shows }.
export async function GET() {
  const { userId, response } = await requireUserId();
  if (!userId)
    return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await getUserPrisma().favorite.findMany({
    where: { userId },
    select: { type: true, key: true },
  });
  return NextResponse.json(groupFavorites(rows));
}

/**
 * PATCH : ajoute ou retire UN favori.
 *
 * Remplace l'ancien `PUT` qui réécrivait l'intégralité des favoris à chaque
 * clic. Une mutation ciblée est non seulement plus légère, mais surtout elle
 * supprime la classe de bugs des écritures concurrentes : deux onglets qui
 * poussaient chacun leur vision complète de la liste pouvaient s'écraser
 * mutuellement.
 *
 * Corps attendu : `{ namespace: "parks" | "rides" | "shows", key: string,
 * value: boolean }`.
 */
export async function PATCH(request: NextRequest) {
  const { userId, response } = await requireUserId();
  if (!userId)
    return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    namespace?: unknown;
    key?: unknown;
    value?: unknown;
  } | null;

  const namespace = body?.namespace;
  const key = body?.key;
  const value = body?.value;

  if (
    typeof namespace !== "string" ||
    !(namespace in NAMESPACE_TO_TYPE) ||
    typeof key !== "string" ||
    !key ||
    typeof value !== "boolean"
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const type = NAMESPACE_TO_TYPE[namespace as FavNamespace];
  const prisma = getUserPrisma();

  if (value) {
    // Plafond vérifié CÔTÉ SERVEUR : le contrôle client seul se contournait
    // trivialement (et ne voyait pas les ajouts faits depuis un autre appareil).
    const limit = FAV_LIMITS[namespace];
    if (limit !== undefined) {
      const count = await prisma.favorite.count({ where: { userId, type } });
      if (count >= limit) {
        return NextResponse.json(
          { error: "Limit reached", limit },
          { status: 409 },
        );
      }
    }
    await prisma.favorite.createMany({
      data: [{ userId, type, key }],
      skipDuplicates: true,
    });
  } else {
    await prisma.favorite.deleteMany({ where: { userId, type, key } });
  }

  const rows = await prisma.favorite.findMany({
    where: { userId },
    select: { type: true, key: true },
  });
  return NextResponse.json(groupFavorites(rows));
}
