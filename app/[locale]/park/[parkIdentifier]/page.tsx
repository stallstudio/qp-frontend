"use client";

import ParkHeader from "@/components/parks/header";
import ParkSkeleton from "@/components/parks/skeleton";
import ParkWaitTimeTable from "@/components/parks/waitTimeTable";
import Footer from "@/components/ui/footer";
import { ParkData } from "@/types/park";
import axios from "axios";
import { useRouter } from "@/i18n/routing";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export default function ParkPage({
  params,
}: {
  params: Promise<{ parkIdentifier: string; locale: string }>;
}) {
  const t = useTranslations("errors");
  const router = useRouter();
  const { parkIdentifier } = use(params);
  const [parkData, setParkData] = useState<ParkData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchParkData = async (showLoading: boolean) => {
    if (showLoading) setLoading(true);
    const apiUrl = process.env.NEXT_PUBLIC_WORKER_API_URL;
    const apiToken = process.env.NEXT_PUBLIC_WORKER_API_KEY;
    if (!apiToken || !apiUrl) {
      router.push("/");
      toast.error(t("configError"));
      return;
    }
    try {
      const response = await axios.get(
        `${apiUrl}/waittimes/${parkIdentifier}`,
        {
          headers: {
            "x-api-key": apiToken,
          },
        },
      );
      setParkData(response.data);
    } catch (error: any) {
      router.push("/");
      toast.error(t("parkNotFound"));
      console.error(error.response?.data);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchParkData(true);
  }, [parkIdentifier, router]);

  useEffect(() => {
    if (parkData?.name) {
      document.title = `${parkData.name} | Queue Park`;
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
    <div className="flex min-h-screen w-full mx-auto max-w-4xl flex-col px-4">
      <main className="flex-1 flex flex-col gap-1 mb-6 mt-4">
        <ParkHeader park={parkData} />
        <ParkWaitTimeTable
          waitTimes={parkData.waitTimes}
          lastUpdate={parkData.lastUpdate}
          onRefresh={() => fetchParkData(false)}
        />
      </main>
      <Footer />
    </div>
  );
}
