import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { getUserPrisma } from "@/lib/user-prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Abonnements Web Push de l'utilisateur (un par appareil). Produits côté client
// par PushManager.subscribe() (voir lib/push-client.ts) et consommés par le moteur
// /api/cron/alerts.

// POST : enregistre (ou rafraîchit) l'abonnement de l'appareil courant. Upsert par
// `endpoint` : un même appareil qui se ré-abonne met simplement à jour ses clés.
export async function POST(request: NextRequest) {
  const { userId, response } = await requireUserId();
  if (!userId) return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const endpoint = body.endpoint;
  const p256dh = body.p256dh;
  const auth = body.auth;
  if (
    typeof endpoint !== "string" ||
    typeof p256dh !== "string" ||
    typeof auth !== "string" ||
    endpoint.length > 500
  ) {
    return NextResponse.json(
      { error: "Invalid subscription payload" },
      { status: 400 },
    );
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 255) ?? null;

  await getUserPrisma().pushSubscription.upsert({
    where: { endpoint },
    // On (re)rattache l'endpoint à l'utilisateur courant : si le même appareil
    // change de compte, il suit le compte connecté.
    update: { userId, p256dh, auth, userAgent },
    create: { userId, endpoint, p256dh, auth, userAgent },
  });

  return NextResponse.json({ success: true }, { status: 201 });
}

// DELETE : supprime l'abonnement de l'appareil courant (désabonnement). L'endpoint
// est transmis dans le corps.
export async function DELETE(request: NextRequest) {
  const { userId, response } = await requireUserId();
  if (!userId) return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const endpoint = body?.endpoint;
  if (typeof endpoint !== "string") {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }

  // Scoping par userId : on ne supprime que ses propres abonnements.
  await getUserPrisma().pushSubscription.deleteMany({
    where: { endpoint, userId },
  });

  return NextResponse.json({ success: true });
}
