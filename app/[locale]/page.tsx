import { getLocale } from "next-intl/server";
import HomePageClient from "@/components/home/home-page-client";
import HomeSkeleton from "@/components/home/home-skeleton";
import { getHomeData } from "@/lib/dispatch";
import type { ParkList } from "@/types/api";

// Le classement des « parcs populaires » reflète les 2 dernières heures : la
// page est donc rendue à la demande (la liste des parcs, elle, est mémorisée
// 5 min par l'API Dispatch).
export const dynamic = "force-dynamic";

export default async function Home() {
  // Chargement côté SERVEUR : le HTML contient la liste des parcs
  // (contrairement à l'ancien composant client qui affichait un squelette puis
  // appelait `/api/parks`).
  let parks: ParkList[] = [];
  let popularParks: ParkList[] = [];
  let failed = false;

  try {
    // Les noms de pays arrivent traduits dans la langue de la page : c'est
    // l'API qui les traduit, sous Node — `Intl.DisplayNames` ne donne pas le
    // même libellé dans le navigateur.
    const data = await getHomeData(await getLocale());
    parks = data.parks;
    popularParks = data.popularParks
      .map((identifier) =>
        parks.find((park) => park.identifier === identifier),
      )
      .filter((park): park is ParkList => park !== undefined);
  } catch (error) {
    console.error("Failed to load home data", error);
    failed = true;
  }

  // API injoignable : on garde le squelette plutôt qu'une page vide. Il
  // disparaîtra au prochain chargement, la page étant rendue à chaque requête.
  if (failed) {
    return <HomeSkeleton />;
  }

  return <HomePageClient parks={parks} popularParks={popularParks} />;
}
