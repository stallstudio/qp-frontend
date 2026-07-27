import HomePageClient from "@/components/home/home-page-client";
import HomeSkeleton from "@/components/home/home-skeleton";
import { getHomeData } from "@/lib/parks-list";
import type { ParkList } from "@/types/api";

// Le classement des « parcs populaires » reflète les 2 dernières heures : la
// page est donc rendue à la demande (la liste des parcs, elle, est mémorisée
// 5 min côté `lib/parks-list.ts`).
export const dynamic = "force-dynamic";

export default async function Home() {
  // Chargement côté SERVEUR, en appelant la couche métier directement : le HTML
  // contient la liste des parcs (contrairement à l'ancien composant client qui
  // affichait un squelette puis appelait `/api/parks`).
  let parks: ParkList[] = [];
  let popularParks: ParkList[] = [];
  let failed = false;

  try {
    const data = await getHomeData();
    parks = data.parks;
    popularParks = data.popularParks
      .map((identifier) =>
        data.parks.find((park) => park.identifier === identifier),
      )
      .filter((park): park is ParkList => park !== undefined);
  } catch (error) {
    console.error("Failed to load home data", error);
    failed = true;
  }

  // Base injoignable : on garde le squelette plutôt qu'une page vide. Il
  // disparaîtra au prochain chargement, la page étant rendue à chaque requête.
  if (failed) {
    return <HomeSkeleton />;
  }

  return <HomePageClient parks={parks} popularParks={popularParks} />;
}
