"use client";

import axios from "axios";
import { useEffect, useState, useCallback } from "react";
import HomeHeader from "@/components/home/header";
import Footer from "@/components/ui/footer";
import SearchBar from "@/components/search/search-bar";
import PopularParks from "@/components/home/popular-parks";
import ParksList from "@/components/home/parks-list";
import HomeSkeleton from "@/components/home/home-skeleton";
import { useTranslations } from "next-intl";
import { ParkList, ParkListData } from "@/types/api";
import WelcomeV2 from "@/components/home/welcome-v2";
export default function Home() {
  const t = useTranslations("errors");
  const [parks, setParks] = useState<ParkList[]>([]);
  const [popularParks, setPopularParks] = useState<ParkList[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchParks = useCallback(async () => {
    setLoading(true);

    try {
      const response = await axios.get<{ data: ParkListData }>("/api/parks");
      setParks(response.data.data.parks);

      const popularParksData = response.data.data.popularParks
        .map((identifier) =>
          response.data.data.parks.find(
            (park) => park.identifier === identifier,
          ),
        )
        .filter((park): park is ParkList => park !== undefined);
      setPopularParks(popularParksData);
    } catch (error) {
      console.error(t("fetchError"), error);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchParks();
  }, [fetchParks]);

  if (loading) {
    return <HomeSkeleton />;
  }

  return (
    <div className="flex min-h-screen w-full mx-auto max-w-4xl flex-col px-4 gap-8">
      <WelcomeV2 />
      <main className="flex-1 flex flex-col gap-8">
        <HomeHeader />

        <SearchBar parks={parks} />

        <PopularParks popularParks={popularParks} />

        <ParksList parks={parks} />
      </main>
      <Footer />
    </div>
  );
}
