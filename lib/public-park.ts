import { getPrisma } from "@/lib/prisma";

export interface PublicPark {
  id: number;
  name: string;
  timezone: string;
}

/**
 * Resolve a public park by its URL identifier (slug). Only parks flagged
 * `display: true` are reachable from the public frontend — same gate the live
 * park endpoint uses.
 */
export async function getPublicPark(
  identifier: string,
): Promise<PublicPark | null> {
  const prisma = getPrisma();
  const park = await prisma.park.findUnique({
    where: { identifier, display: true },
    select: { id: true, name: true, timezone: true },
  });
  if (!park) return null;
  return {
    id: park.id,
    name: park.name,
    timezone: park.timezone || "Europe/Paris",
  };
}
