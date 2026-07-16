import { NextRequest, NextResponse } from "next/server";
import { getPublicPark } from "@/lib/public-park";
import {
  getUsableDates,
  getLatestUsableDate,
} from "@/lib/park-usable-days";

/**
 * The set of past days that actually have usable data — what the calendar makes
 * navigable. No future days: the public view shows history only, never forecasts.
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
    const { id, timezone } = park;

    if (searchParams.get("latest")) {
      return NextResponse.json({
        latest: await getLatestUsableDate(id, timezone),
      });
    }

    const year = searchParams.get("year");
    const month = searchParams.get("month");

    let dates: string[];
    if (year && month) {
      const y = parseInt(year);
      const m = parseInt(month);
      // 2-day buffer around month boundaries for timezone offset.
      const bufferStart = new Date(Date.UTC(y, m - 1, 1) - 2 * 86400_000);
      const bufferEnd = new Date(Date.UTC(y, m, 1) + 2 * 86400_000);
      dates = await getUsableDates(id, timezone, {
        from: bufferStart,
        to: bufferEnd,
      });
    } else if (year) {
      const y = parseInt(year);
      dates = await getUsableDates(id, timezone, {
        from: new Date(Date.UTC(y, 0, 1)),
        to: new Date(Date.UTC(y + 1, 0, 1)),
      });
    } else {
      dates = await getUsableDates(id, timezone);
    }

    return NextResponse.json(
      { dates },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch (error) {
    console.error("Error fetching available dates:", error);
    return NextResponse.json(
      { error: "Failed to fetch available dates" },
      { status: 500 },
    );
  }
}
