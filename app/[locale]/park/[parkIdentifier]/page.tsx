"use client";

import ParkHeader from "@/components/parks/header";
import ParkSkeleton from "@/components/parks/skeleton";
import Footer from "@/components/ui/footer";
import axios from "axios";
import { useRouter } from "@/i18n/routing";
import { use, useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import MainCard from "@/components/parks/main-card";
import { ParkLiveData } from "@/types/api";

export default function ParkPage({
  params,
}: {
  params: Promise<{
    parkIdentifier: string;
    locale: string;
  }>;
}) {
  const t = useTranslations("errors");
  const router = useRouter();
  const { parkIdentifier } = use(params);
  const [parkData, setParkData] = useState<ParkLiveData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchParkData = useCallback(
    async (showLoading: boolean) => {
      if (showLoading) setLoading(true);
      try {
        const response = await axios.get<{ data: ParkLiveData }>(
          `/api/park/${parkIdentifier}`,
        );
        setParkData(response.data.data);
      } catch (error: unknown) {
        router.push("/");
        toast.error(t("parkNotFound"));

        console.error(error instanceof Error ? error.message : error);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [parkIdentifier, router, t],
  );

  useEffect(() => {
    fetchParkData(true);
  }, [parkIdentifier, router, fetchParkData]);

  useEffect(() => {
    if (parkData?.name) {
      document.title = `${parkData.name} - Queue Park`;
    }
  }, [parkData]);

  if (loading) {
    return <ParkSkeleton />;
  }

  if (!parkData || !parkIdentifier) {
    router.push("/");
    toast.error(t("parkNotFound"));
    return;
  }

  return (
    <div className="flex min-h-[123vh] w-full mx-auto max-w-4xl flex-col px-4 gap-8">
      <main className="flex-1 flex flex-col gap-1 mt-4">
        <ParkHeader park={parkData} />
        <MainCard park={parkData} onRefresh={() => fetchParkData(false)} />
      </main>
      <Footer />
    </div>
  );
}
