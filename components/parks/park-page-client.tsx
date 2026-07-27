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
import { PARK_PAGE_SHELL } from "@/components/parks/page-shell";

/**
 * Partie interactive de la page d'un parc.
 *
 * `initialData` vient du composant SERVEUR : la page est donc peinte complète
 * dès le premier rendu, sans squelette ni aller-retour réseau. Ce composant ne
 * garde que ce qui doit vivre côté client — le rafraîchissement automatique
 * (60 s) et la gestion des erreurs réseau qui vont avec.
 *
 * `initialData` n'est `null` que si la base était injoignable au moment du
 * rendu : on retombe alors sur l'ancien comportement (squelette + chargement).
 */
export default function ParkPageClient({
  parkIdentifier,
  initialData,
  initialRideId = null,
}: {
  parkIdentifier: string;
  initialData: ParkLiveData | null;
  // Lien profond `/park/{parc}/ride/{slug}` : attraction dont le popup doit être
  // ouvert d'emblée (notification push, lien partagé).
  initialRideId?: number | null;
}) {
  const t = useTranslations("errors");
  const router = useRouter();
  const [parkData, setParkData] = useState<ParkLiveData | null>(initialData);
  const [loading, setLoading] = useState(initialData === null);
  const hasLoadedData = useRef(initialData !== null);

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
    // Données déjà rendues côté serveur : aucun appel au montage. Le premier
    // rafraîchissement viendra du décompte de `useAutoRefresh`, comme les suivants.
    if (initialData !== null) return;
    fetchParkData(true);
    // `initialData` n'est lu qu'au montage (il ne change pas pour un même parc) :
    // le relire ici relancerait un chargement à chaque nouveau rendu serveur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parkIdentifier, fetchParkData]);

  if (loading) {
    return <ParkSkeleton />;
  }

  if (!parkData || !parkIdentifier) {
    return null;
  }

  return (
    <div className={PARK_PAGE_SHELL}>
      <main className="flex-1 flex flex-col gap-1 mt-4">
        <ParkHeader park={parkData} />
        <MainCard
          park={parkData}
          initialRideId={initialRideId}
          onRefresh={async () => {
            await fetchParkData(false);
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
