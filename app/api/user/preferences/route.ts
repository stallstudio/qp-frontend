import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { getUserPrisma } from "@/lib/user-prisma";
import {
  DEFAULT_PREFERENCES,
  parsePreferencesPatch,
  timeFormatFromDb,
  timeFormatToDb,
} from "@/lib/user-preferences";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Le pilote MariaDB de Prisma utilise un contrôle de concurrence optimiste : si
// deux écritures touchent la MÊME ligne « en même temps » (typiquement quand on
// change de langue plusieurs fois d'affilée, ce qui enchaîne les PATCH), l'une
// échoue avec « Record has changed since last read ». C'est transitoire : on
// réessaie quelques fois avec un court back-off. Le dernier PATCH gagne, ce qui
// est exactement le comportement voulu.
const CONFLICT_MARKER = "Record has changed since last read";
const MAX_RETRIES = 4;

function isConflict(error: unknown): boolean {
  const msg =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return msg.includes(CONFLICT_MARKER);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Met à jour une ou plusieurs préférences (langue / thème / format horaire).
// Renvoie l'état complet des préférences après mise à jour.
export async function PATCH(request: NextRequest) {
  const { userId, response } = await requireUserId();
  if (!userId) return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const patch = parsePreferencesPatch(await request.json().catch(() => null));
  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No valid preference provided" },
      { status: 400 },
    );
  }

  const prisma = getUserPrisma();

  // Un SEUL upsert : crée la ligne si absente, sinon applique le patch. Réduit la
  // fenêtre de conflit à une écriture (au lieu de upsert + update + upsert).
  // Toute sauvegarde explicite marque le compte comme initialisé.
  const update = {
    initialized: true,
    ...(patch.locale !== undefined && { locale: patch.locale }),
    ...(patch.theme !== undefined && { theme: patch.theme }),
    ...(patch.timeFormat !== undefined && {
      timeFormat: timeFormatToDb(patch.timeFormat),
    }),
    ...(patch.temperatureUnit !== undefined && {
      temperatureUnit: patch.temperatureUnit,
    }),
  };
  const create = {
    userId,
    initialized: true,
    locale: patch.locale ?? DEFAULT_PREFERENCES.locale,
    theme: patch.theme ?? DEFAULT_PREFERENCES.theme,
    timeFormat: patch.timeFormat
      ? timeFormatToDb(patch.timeFormat)
      : ("h24" as const),
    temperatureUnit:
      patch.temperatureUnit ?? DEFAULT_PREFERENCES.temperatureUnit,
  };

  for (let attempt = 0; ; attempt++) {
    try {
      const row = await prisma.userPreferences.upsert({
        where: { userId },
        update,
        create,
      });
      return NextResponse.json({
        locale: row.locale,
        theme: row.theme,
        timeFormat: timeFormatFromDb(row.timeFormat),
        temperatureUnit: row.temperatureUnit,
      });
    } catch (error) {
      if (isConflict(error) && attempt < MAX_RETRIES) {
        await sleep(40 * (attempt + 1)); // back-off court et croissant
        continue;
      }
      throw error;
    }
  }
}
