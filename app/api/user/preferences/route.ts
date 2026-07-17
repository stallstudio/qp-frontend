import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { getUserPrisma } from "@/lib/user-prisma";
import { getPreferences } from "@/lib/user-account";
import { parsePreferencesPatch, timeFormatToDb } from "@/lib/user-preferences";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Met à jour une ou plusieurs préférences (langue / thème / format horaire).
// Renvoie l'état complet des préférences après mise à jour.
export async function PATCH(request: NextRequest) {
  const { userId, response } = await requireUserId();
  if (!userId) return response;

  const patch = parsePreferencesPatch(await request.json().catch(() => null));
  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No valid preference provided" },
      { status: 400 },
    );
  }

  const prisma = getUserPrisma();
  // Garantit l'existence de la ligne avant update (crée le défaut si besoin).
  await getPreferences(userId);

  await prisma.userPreferences.update({
    where: { userId },
    data: {
      // Toute sauvegarde explicite marque le compte comme initialisé : les
      // logins suivants appliqueront ces préférences (compte prime).
      initialized: true,
      ...(patch.locale !== undefined && { locale: patch.locale }),
      ...(patch.theme !== undefined && { theme: patch.theme }),
      ...(patch.timeFormat !== undefined && {
        timeFormat: timeFormatToDb(patch.timeFormat),
      }),
    },
  });

  const { preferences } = await getPreferences(userId);
  return NextResponse.json(preferences);
}
