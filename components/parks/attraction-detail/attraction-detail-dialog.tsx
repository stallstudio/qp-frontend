"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useTranslations } from "next-intl";
import { Bell, LineChart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { WaitTime } from "@/types/waitTime";
import type { RideHistoryResponse } from "@/types/rideHistory";
import ImageSection from "./image-section";
import AlertSection from "./alert-section";
import ChartSection from "./chart-section";

type AttractionDetailDialogProps = {
  target: WaitTime | null;
  parkIdentifier: string;
  parkName: string;
  onOpenChange: (open: boolean) => void;
};

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t px-5 py-3">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

// Popup « détail attraction » : centralise image (nom + lien Thrills en overlay),
// favoris, alertes et graphique. Ouvert quand `target` est non nul.
export default function AttractionDetailDialog({
  target,
  parkIdentifier,
  parkName,
  onOpenChange,
}: AttractionDetailDialogProps) {
  const t = useTranslations("attractionDetail");

  // Historique + prévision récupérés ICI (et rafraîchis toutes les 60 s tant que
  // le popup est ouvert) puis partagés : le graphique l'affiche, et la section
  // Alertes s'en sert pour savoir si l'attraction est indisponible en continu.
  const rideId = target?.rideId;
  const [history, setHistory] = useState<RideHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    if (rideId == null) return;
    const controller = new AbortController();
    let cancelled = false;

    const fetchHistory = () =>
      axios
        .get<{ data: RideHistoryResponse }>(
          `/api/park/${parkIdentifier}/ride/${rideId}/history`,
          { signal: controller.signal },
        )
        .then((res) => {
          if (!cancelled) setHistory(res.data.data);
        })
        .catch(() => {
          // Le graphique est un bonus : en cas d'échec on garde l'état courant.
        });

    setHistoryLoading(true);
    setHistory(null);
    fetchHistory().finally(() => {
      if (!cancelled) setHistoryLoading(false);
    });

    const interval = setInterval(fetchHistory, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      controller.abort();
    };
  }, [rideId, parkIdentifier]);

  const chronicallyUnavailable =
    history?.meta.chronicallyUnavailable ?? false;

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      {/* rounded-4xl : même radius que l'en-tête de parc et le container temps
          d'attente (main-card). overflow-hidden clippe l'image du haut sur les
          coins arrondis ; le défilement est confié au seul corps (voir plus bas).
          Layout en colonne flex : en-tête ÉPINGLÉE (image + favori, `shrink-0`)
          + corps DÉFILANT (`flex-1 min-h-0 overflow-y-auto`). Ainsi le bouton
          favori reste TOUJOURS visible, quoi qu'il arrive au montage des sections
          asynchrones (alertes, graphique) : il ne peut plus être poussé
          hors champ par leur croissance ni par un focus qui ferait défiler. */}
      <DialogContent
        className="flex max-h-[88vh] flex-col gap-0 overflow-hidden rounded-4xl p-0 sm:max-w-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {target && (
          <>
            {/* Titre/description accessibles (le nom visible est sur la photo). */}
            <DialogHeader className="sr-only">
              <DialogTitle>{target.rideName}</DialogTitle>
              <DialogDescription>
                {t("openFor", { ride: target.rideName })}
              </DialogDescription>
            </DialogHeader>

            {/* En-tête épinglée (ne défile pas) : bannière avec le nom, le lien
                Thrills et l'étoile favori intégrés (plus de gros bouton séparé). */}
            <div className="shrink-0">
              <ImageSection
                title={target.rideName}
                favNamespace="rides"
                favKey={`${parkIdentifier}:${target.rideId}`}
                link={{ url: "https://thrills.world", label: t("thrillsLink") }}
              />
            </div>

            {/* Corps défilant : alertes + graphique. `scrollbar-hide` masque
                la barre de défilement (le petit dépassement résiduel reste
                scrollable, mais sans barre visible). */}
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
              <Section
                title={t("alertsTitle")}
                icon={<Bell className="size-4" />}
              >
                {/* Hauteur minimale réservée, ajustée au plus près de la hauteur
                    réelle du formulaire : le popup ne « saute » pas entre le
                    spinner et l'affichage, SANS créer de grand vide sous le bouton. */}
                <div className="min-h-[136px]">
                <AlertSection
                  rideId={target.rideId}
                  rideName={target.rideName}
                  parkIdentifier={parkIdentifier}
                  parkName={parkName}
                  unavailable={chronicallyUnavailable}
                  currentWaitTime={(() => {
                    // Temps standby actuel (seulement si ouvert et exploitable) :
                    // sert au seuil par défaut « un cran en dessous ».
                    const standby = target.queues.find(
                      (q) => q.type === "standby",
                    );
                    return standby &&
                      standby.status === "open" &&
                      standby.waitTime >= 0
                      ? standby.waitTime
                      : undefined;
                  })()}
                />
                </div>
              </Section>

              <Section
                title={t("chartTitle")}
                icon={<LineChart className="size-4" />}
              >
                <ChartSection data={history} loading={historyLoading} />
              </Section>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
