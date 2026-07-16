import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getPublicPark } from "@/lib/public-park";

/**
 * A one-line opening window per day for a month, so the calendar cells can show
 * hours without a request per day. A day can carry several typed rows (standard,
 * early access, extension…) but the calendar only shows the *standard* window —
 * the extra slots ("plus tôt / plus tard / prolongé") are kept for the day-detail
 * endpoint. Since (parkId, date, type) is unique there is at most one standard row
 * per day.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ parkId: string }> },
) {
  try {
    const { parkId } = await params;
    const park = await getPublicPark(parkId);
    if (!park) {
      return NextResponse.json({ error: "Park not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const prisma = getPrisma();

    // ?debug=1 → what opening-hours rows this park actually has, and under which
    // `type`. The calendar only shows type="standard"; a park whose hours are
    // stored under another type (or that has no rows at all) shows nothing.
    if (searchParams.get("debug")) {
      const all = await prisma.openingHours.findMany({
        where: { parkId: park.id },
        select: { date: true, type: true, openTime: true, closeTime: true },
        orderBy: { date: "asc" },
        take: 800,
      });
      const byType: Record<string, number> = {};
      for (const r of all) byType[r.type] = (byType[r.type] ?? 0) + 1;
      return NextResponse.json(
        {
          park: { id: park.id, name: park.name },
          totalRows: all.length,
          byType,
          sample: all.slice(0, 40),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const year = searchParams.get("year");
    const month = searchParams.get("month");
    if (!year || !month) {
      return NextResponse.json({ hours: {} });
    }
    const prefix = `${year}-${String(parseInt(month)).padStart(2, "0")}`;
    const rows = await prisma.openingHours.findMany({
      where: { parkId: park.id, date: { startsWith: prefix }, type: "standard" },
      select: { date: true, openTime: true, closeTime: true },
    });

    const hours: Record<string, { open: string | null; close: string | null }> =
      {};
    for (const r of rows) {
      hours[r.date] = {
        open: r.openTime ? r.openTime.toISOString() : null,
        close: r.closeTime ? r.closeTime.toISOString() : null,
      };
    }

    return NextResponse.json(
      { hours },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch (error) {
    console.error("Error fetching month opening hours:", error);
    return NextResponse.json(
      { error: "Failed to fetch opening hours" },
      { status: 500 },
    );
  }
}
