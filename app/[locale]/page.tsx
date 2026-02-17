"use client";

import { Park, ParksResponse, ParkGroup } from "@/types/park";
import axios from "axios";
import { useEffect, useState, useCallback } from "react";
import HomeHeader from "@/components/home/header";
import Footer from "@/components/ui/footer";
import SearchBar from "@/components/search/search-bar";
import PopularParks from "@/components/home/popular-parks";
import ParksList from "@/components/home/parks-list";
import HomeSkeleton from "@/components/home/home-skeleton";
import { useTranslations } from "next-intl";
export default function Home() {
  const t = useTranslations("errors");
  const [parks, setParks] = useState<Park[]>([]);
  const [groups, setGroups] = useState<ParkGroup[]>([]);
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
      const response = await axios.get<ParksResponse>(`${apiUrl}/parks`, {
        headers: {
          "x-api-key": apiToken,
        },
      });
      setParks(response.data.parks);
      setGroups(response.data.groups);
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
    <div className="flex min-h-screen w-full mx-auto max-w-4xl flex-col px-4">
      <main className="flex-1 flex flex-col gap-8">
        <HomeHeader />

        <SearchBar parks={parks} groups={groups} />

        <PopularParks popularParks={parks.slice(0, 6)} />

        <ParksList parks={parks} groups={groups} />
      </main>
      <Footer />
    </div>
  );
}
