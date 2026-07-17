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
