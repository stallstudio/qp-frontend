"use client";

import { DateTime } from "luxon";
import { useLocale, useTranslations } from "next-intl";
import { Bell, Clock } from "lucide-react";
import { getLuxonFormat } from "@/lib/utils";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ShowTime } from "@/types/show";
import ImageSection from "@/components/parks/attraction-detail/image-section";
import NotificationGate from "@/components/parks/notification-gate";
import {
  getShowAccessInfo,
  formatDuration,
} from "@/components/parks/show-time-table/utils";
import ReminderSection from "./reminder-section";

type ShowDetailDialogProps = {
  target: ShowTime | null;
  parkIdentifier: string;
  parkName: string;
  timezone: string;
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

// Popup « détail spectacle » : calqué sur celui des attractions (image + favori
// épinglés en haut, corps défilant) mais SANS graphique — la section unique est
// « Notifications » (rappels programmés avant chaque représentation du jour).
export default function ShowDetailDialog({
  target,
  parkIdentifier,
  parkName,
  timezone,
  onOpenChange,
}: ShowDetailDialogProps) {
  const t = useTranslations("showDetail");
  const locale = useLocale();
  const { is12Hour } = useTimeFormat();

  // Sous-titre du popup : soit une plage d'accès (attractions à ACCÈS CONTINU,
  // ex. Puy du Fou 12:00–20:15), soit une durée de représentation. `duration`
  // seul induirait en erreur pour un accès continu (cf. getShowAccessInfo).
  const access = target ? getShowAccessInfo(target, timezone) : null;
  let subtitle: string | undefined;
  if (access?.kind === "continuous") {
    const fmt = getLuxonFormat(is12Hour);
    const start = DateTime.fromISO(access.startTime, { zone: timezone }).toFormat(fmt);
    const end = DateTime.fromISO(access.endTime, { zone: timezone }).toFormat(fmt);
    subtitle = t("continuousAccess", { range: `${start} – ${end}` });
  } else if (access?.kind === "duration") {
    subtitle = t("duration", { duration: formatDuration(access.minutes, locale) });
  }

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[88vh] flex-col gap-0 overflow-hidden rounded-4xl border-0 p-0 sm:max-w-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {target && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>{target.showName}</DialogTitle>
              <DialogDescription>
                {t("openFor", { show: target.showName })}
              </DialogDescription>
            </DialogHeader>

            {/* En-tête épinglée : bannière + nom + étoile favori (namespace shows). */}
            <div className="shrink-0">
              <ImageSection
                title={target.showName}
                favNamespace="shows"
                favKey={`${parkIdentifier}:${target.showName}`}
                link={{
                  url: "https://thrills.world",
                  label: t("thrillsLink"),
                }}
              />
            </div>

            {/* Corps défilant : durée + alertes (pas de graphique). Hauteur
                minimale réservée pour que le popup ne « saute » pas entre le
                chargement (spinner) et l'affichage des créneaux. */}
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
              {subtitle && (
                <div className="flex items-center gap-2 px-5 py-3 text-sm text-muted-foreground">
                  <Clock className="size-4 shrink-0" />
                  {subtitle}
                </div>
              )}
              <Section
                title={t("notifTitle")}
                icon={<Bell className="size-4" />}
              >
                <div className="min-h-[160px]">
                  <NotificationGate signInIntro={t("signInIntro")}>
                    <ReminderSection
                      parkIdentifier={parkIdentifier}
                      parkName={parkName}
                      showName={target.showName}
                      duration={target.duration}
                      schedules={target.schedules}
                      timezone={timezone}
                    />
                  </NotificationGate>
                </div>
              </Section>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
