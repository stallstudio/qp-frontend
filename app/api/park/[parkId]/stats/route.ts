import { NextRequest, NextResponse } from "next/server";
import { DateTime } from "luxon";
import { getPublicPark } from "@/lib/public-park";
import { getParkDayStats } from "@/lib/park-stats";

/**
 * Stats for a single day: typed opening hours, the park-wide hourly profile, and
 * every ride that ran that day sorted busiest-first (by mean wait). Historical
 * days are immutable, so they cache hard; today never caches.
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
    const today = DateTime.now().setZone(park.timezone).toISODate() ?? "";
    const dateStr = searchParams.get("date") || today;

    const stats = await getParkDayStats(park, dateStr);

    const cacheHeader =
      dateStr === today
        ? "no-store"
        : "public, s-maxage=3600, stale-while-revalidate=600";

    return NextResponse.json(stats, {
      headers: { "Cache-Control": cacheHeader },
    });
  } catch (error) {
    console.error("Error fetching park day stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch park stats" },
      { status: 500 },
    );
  }
}
