import { NextResponse } from "next/server";
import { getPublicPark } from "@/lib/public-park";
import {
  getParkAffluence,
  getParkAffluenceDebug,
  type DayAffluence,
} from "@/lib/park-affluence";

/**
 * The whole trailing year of affluence in one response, cached in memory.
 *
 * Both the per-ride baselines and the level cuts are drawn from the park's full
 * history, so narrowing to one month would run the same scan and return less.
 * The calendar prefetches this once and colours every visible month from it.
 */
const CACHE_TTL_MS = 60 * 60 * 1000;

const cache = new Map<number, { at: number; days: Record<string, DayAffluence> }>();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ parkId: string }> },
) {
  try {
    const { parkId } = await params;
    const park = await getPublicPark(parkId);
    if (!park) {
      return NextResponse.json({ error: "Park not found" }, { status: 404 });
    }

    if (new URL(request.url).searchParams.get("debug")) {
      const debug = await getParkAffluenceDebug(park.id, park.timezone);
      return NextResponse.json(
        { park: { id: park.id, name: park.name }, debug },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const cached = cache.get(park.id);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return NextResponse.json(
        { days: cached.days },
        { headers: { "Cache-Control": "public, max-age=300" } },
      );
    }

    const affluence = await getParkAffluence(park.id, park.timezone);
    const days = Object.fromEntries(affluence);
    cache.set(park.id, { at: Date.now(), days });

    return NextResponse.json(
      { days },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch (error) {
    console.error("Error computing affluence:", error);
    return NextResponse.json(
      { error: "Failed to compute affluence" },
      { status: 500 },
    );
  }
}
