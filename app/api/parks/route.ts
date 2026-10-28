import { NextResponse } from "next/server";
import { dispatchFetch, relay } from "@/lib/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liste des parcs + parcs populaires, servie par l'API Dispatch (`/v1/parks`)
 * telle quelle, en-tête de cache compris.
 *
 * La page d'accueil ne passe pas par ici pour son PREMIER affichage (son
 * composant serveur appelle `getHomeData`) : cette route sert aux
 * rechargements côté client.
 */
export async function GET() {
  try {
    return relay(await dispatchFetch("/v1/parks"));
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
