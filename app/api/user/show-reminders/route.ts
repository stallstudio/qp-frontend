import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { getUserPrisma } from "@/lib/user-prisma";
import { toShowReminderDTO } from "@/lib/user-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Délais autorisés (minutes avant le début d'une représentation).
const ALLOWED_LEADS = [10, 20, 30, 40, 50, 60];

// GET : rappels de spectacle de l'utilisateur. Filtrables par parc + spectacle
// (le popup d'un spectacle ne charge que ses propres rappels pour pré-remplir
// l'état des vignettes). Les plus proches d'abord.
export async function GET(request: NextRequest) {
  const { userId, response } = await requireUserId();
  if (!userId)
    return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parkIdentifier = request.nextUrl.searchParams.get("parkIdentifier");
  const showName = request.nextUrl.searchParams.get("showName");

  const rows = await getUserPrisma().showReminder.findMany({
    where: {
      userId,
      ...(parkIdentifier ? { parkIdentifier } : {}),
      ...(showName ? { showName } : {}),
    },
    orderBy: { startTime: "asc" },
  });
  return NextResponse.json(rows.map(toShowReminderDTO));
}

// POST : crée (ou met à jour le délai d') un rappel pour une représentation
// précise (parkIdentifier + showName + startTime). Re-soumettre réarme le rappel
// (sent=false) et recalcule fireAt = startTime - leadMinutes.
export async function POST(request: NextRequest) {
  const { userId, response } = await requireUserId();
  if (!userId)
    return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parkIdentifier = body.parkIdentifier;
  const parkName = body.parkName;
  const showName = body.showName;
  const leadMinutes = Number(body.leadMinutes);
  const startTimeRaw = body.startTime;

  if (
    typeof parkIdentifier !== "string" ||
    typeof parkName !== "string" ||
    typeof showName !== "string" ||
    typeof startTimeRaw !== "string" ||
    !ALLOWED_LEADS.includes(leadMinutes)
  ) {
    return NextResponse.json(
      { error: "Invalid reminder payload" },
      { status: 400 },
    );
  }

  const startTime = new Date(startTimeRaw);
  if (Number.isNaN(startTime.getTime())) {
    return NextResponse.json({ error: "Invalid startTime" }, { status: 400 });
  }

  const fireAt = new Date(startTime.getTime() - leadMinutes * 60_000);

  const reminder = await getUserPrisma().showReminder.upsert({
    where: {
      userId_parkIdentifier_showName_startTime: {
        userId,
        parkIdentifier,
        showName,
        startTime,
      },
    },
    update: { leadMinutes, fireAt, parkName, sent: false, sentAt: null },
    create: {
      userId,
      parkIdentifier,
      parkName,
      showName,
      startTime,
      leadMinutes,
      fireAt,
    },
  });

  return NextResponse.json(toShowReminderDTO(reminder), { status: 201 });
}
