import { cache } from "react";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Renvoie l'id de l'utilisateur connecté, ou null. Les routes /api/user/* passent
// par `requireUserId` pour factoriser la réponse 401.
export async function getSessionUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

type Guard =
  | { userId: string; response: null }
  | { userId: null; response: NextResponse };

export async function requireUserId(): Promise<Guard> {
  const userId = await getSessionUserId();
  if (!userId) {
    return {
      userId: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { userId, response: null };
}

/**
 * `true` si la personne connectée peut voir les parcs masqués
 * (`parks.display = false`) comme s'ils étaient publiés.
 *
 * Mémoïsé par `cache()` pour la durée d'UNE requête : la page, sa métadonnée et
 * la route de rafraîchissement peuvent tous poser la question sans multiplier la
 * lecture de session (qui, en stratégie "database", est une requête SQL).
 *
 * ⚠️ À n'appeler QU'APRÈS avoir constaté qu'un parc est introuvable — voir
 * `resolveParkForViewer` (lib/park-live-data.ts). Le chemin nominal, y compris le
 * rafraîchissement de 60 s de chaque visiteur, ne doit lire aucune session.
 */
export const isAdminViewer = cache(async (): Promise<boolean> => {
  const session = await auth();
  return session?.user?.isAdmin === true;
});
