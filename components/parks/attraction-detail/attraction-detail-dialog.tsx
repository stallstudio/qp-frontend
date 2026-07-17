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
import FavoriteSection from "./favorite-section";
import NotificationSection from "./notification-section";
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
    <section className="border-t px-5 py-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

// Popup « détail attraction » : centralise image (nom + lien Thrills en overlay),
// favoris, notifications et graphique. Ouvert quand `target` est non nul.
export default function AttractionDetailDialog({
  target,
  parkIdentifier,
  parkName,
  onOpenChange,
}: AttractionDetailDialogProps) {
  const t = useTranslations("attractionDetail");

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto p-0 sm:max-w-md">
        {target && (
          <>
            {/* Titre/description accessibles (le nom visible est sur la photo). */}
            <DialogHeader className="sr-only">
              <DialogTitle>{target.rideName}</DialogTitle>
              <DialogDescription>
                {t("openFor", { ride: target.rideName })}
              </DialogDescription>
            </DialogHeader>

            <ImageSection rideName={target.rideName} />

            {/* Favoris : bouton pleine largeur, sans titre (auto-explicite). */}
            <div className="px-5 py-4">
              <FavoriteSection favKey={`${parkIdentifier}:${target.rideId}`} />
            </div>

            <Section
              title={t("notificationsTitle")}
              icon={<Bell className="size-4" />}
            >
              <NotificationSection
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
