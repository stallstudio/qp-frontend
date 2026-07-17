"use client";

import ParkHeader from "@/components/parks/header";
import ParkSkeleton from "@/components/parks/skeleton";
import Footer from "@/components/ui/footer";
import axios from "axios";
import { useRouter } from "@/i18n/routing";
import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import MainCard from "@/components/parks/main-card";
import { ParkLiveData } from "@/types/api";
import ReportProblemDialog from "@/components/parks/report-problem-dialog";

export default function ParkPageClient({
  parkIdentifier,
}: {
  parkIdentifier: string;
}) {
  const t = useTranslations("errors");
  const router = useRouter();
  const [parkData, setParkData] = useState<ParkLiveData | null>(null);
  const [history, setHistory] = useState<Record<number, number[]>>({});
  const [loading, setLoading] = useState(true);
  const hasLoadedData = useRef(false);

  const fetchHistory = useCallback(async () => {
    try {
      const response = await axios.get<{ data: Record<number, number[]> }>(
        `/api/park/${parkIdentifier}/history`,
      );
      setHistory(response.data.data ?? {});
    } catch {
      // L'historique est un bonus : en cas d'échec on masque simplement les sparklines.
    }
  }, [parkIdentifier]);

  const fetchParkData = useCallback(
    async (showLoading: boolean) => {
      if (showLoading) setLoading(true);
      try {
        const response = await axios.get<{ data: ParkLiveData }>(
          `/api/park/${parkIdentifier}`,
        );
        setParkData(response.data.data);
        hasLoadedData.current = true;
      } catch (error: unknown) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          router.push("/");
          toast.error(t("parkNotFound"));
        } else if (hasLoadedData.current) {
          toast.error(t("networkErrorRefresh"));
        } else {
          router.push("/");
          toast.error(t("networkError"));
        }

        console.error(error instanceof Error ? error.message : error);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [parkIdentifier, router, t],
  );

  useEffect(() => {
    fetchParkData(true);
    fetchHistory();
  }, [parkIdentifier, router, fetchParkData, fetchHistory]);

  if (loading) {
    return <ParkSkeleton />;
  }

  if (!parkData || !parkIdentifier) {
    return null;
  }

  return (
    <div className="flex min-h-[123vh] w-full mx-auto max-w-4xl lg:max-w-6xl flex-col px-3 sm:px-4 gap-8">
      <main className="flex-1 flex flex-col gap-1 mt-4">
        <ParkHeader park={parkData} />
        <MainCard
          park={parkData}
          history={history}
          onRefresh={async () => {
            await Promise.all([fetchParkData(false), fetchHistory()]);
          }}
        />
        <div className="flex justify-center mt-4">
          <ReportProblemDialog parkIdentifier={parkIdentifier} />
        </div>
      </main>

      <Footer />
    </div>
  );
}
