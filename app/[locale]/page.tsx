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
import { ParkList, ParkListResponse } from "@/types/park";
export default function Home() {
  const t = useTranslations("errors");
  const [parks, setParks] = useState<ParkList[]>([]);
  const [popularParks, setPopularParks] = useState<ParkList[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchParks = useCallback(async () => {
    setLoading(true);
    const apiUrl = process.env.NEXT_PUBLIC_WORKER_API_URL;
    const apiToken = process.env.NEXT_PUBLIC_WORKER_API_KEY;

    if (!apiToken || !apiUrl) {
      console.error(t("configError"));
      return;
    }

    try {
      const response = await axios.get<ParkListResponse>(`${apiUrl}/parks`, {
        headers: {
          "x-api-key": apiToken,
        },
      });
      setParks(response.data.parks);

      const popularParksData = response.data.popularParks
        .map((identifier) =>
          response.data.parks.find((park) => park.identifier === identifier),
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
