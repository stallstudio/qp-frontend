"use client";

import HomeHeader from "@/components/home/header";
import Footer from "@/components/ui/footer";
import SearchBar from "@/components/search/search-bar";
import PopularParks from "@/components/home/popular-parks";
import FavoriteParks from "@/components/home/favorite-parks";
import UserBlock from "@/components/home/user-block";
import ParksList from "@/components/home/parks-list";
import type { ParkList } from "@/types/api";

/**
 * Partie interactive de l'accueil.
 *
 * Les parcs arrivent du composant SERVEUR, donc rendus dans le HTML : plus de
 * squelette au chargement, et les moteurs de recherche voient la liste. Ce
 * composant reste client car ses enfants le sont (favoris, recherche, session) ;
 * il ne charge plus rien lui-même.
 */
export default function HomePageClient({
  parks,
  popularParks,
}: {
  parks: ParkList[];
  popularParks: ParkList[];
}) {
  return (
    <div className="flex min-h-screen w-full mx-auto max-w-4xl lg:max-w-6xl flex-col px-3 sm:px-4 gap-8">
      <main className="flex-1 flex flex-col gap-8">
        <HomeHeader />

        <SearchBar parks={parks} />

        <UserBlock />

        <FavoriteParks parks={parks} />

        <PopularParks popularParks={popularParks} />

        <ParksList parks={parks} />
      </main>
      <Footer />
    </div>
  );
}
