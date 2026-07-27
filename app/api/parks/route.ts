import { NextResponse } from "next/server";
import { getHomeData } from "@/lib/parks-list";
import { DATA_DISCLAIMER } from "@/lib/api-disclaimer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liste des parcs + parcs populaires.
 *
 * Comme pour la route parc, la page d'accueil ne passe plus par ici pour son
 * PREMIER affichage (son composant serveur appelle `getHomeData` directement) :
 * cette route sert aux rechargements côté client.
 */
export async function GET() {
  try {
    const { parks, popularParks } = await getHomeData();

    return NextResponse.json(
      {
        success: true,
        message: "Parks list retrieved successfully",
        disclaimer: DATA_DISCLAIMER,
        data: { parks, popularParks },
        counts: {
          parks: parks.length,
          popularParks: popularParks.length,
        },
      },
      {
        headers: {
          // Réponse identique pour tout le monde : un cache partagé peut la
          // servir 1 min, et continuer à la servir 5 min de plus pendant qu'il
          // la rafraîchit en arrière-plan.
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching parks list", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to retrieve parks",
      },
      { status: 500 },
    );
  }
}
