"use client";

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
                rideName={target.rideName}
                favKey={`${parkIdentifier}:${target.rideId}`}
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
                <AlertSection
                  rideId={target.rideId}
                  rideName={target.rideName}
                  parkIdentifier={parkIdentifier}
                  parkName={parkName}
                />
              </Section>

              <Section
                title={t("chartTitle")}
                icon={<LineChart className="size-4" />}
              >
                <ChartSection
                  parkIdentifier={parkIdentifier}
                  rideId={target.rideId}
                />
              </Section>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
