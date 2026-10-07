"use client";

import { DateTime } from "luxon";
import { useTranslations } from "next-intl";
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
import {
  Stat,
  StatStrip,
  StatTime,
  StatusValue,
} from "@/components/parks/attraction-detail/live-stats";
import { getShowAccessInfo } from "@/components/parks/show-time-table/utils";
import ShowSchedulePanel, { useShowSlots } from "./show-schedule-panel";
import PoiFacts from "@/components/parks/attraction-detail/poi-facts";

type ShowDetailDialogProps = {
  target: ShowTime | null;
  parkIdentifier: string;
  parkName: string;
  timezone: string;
  onOpenChange: (open: boolean) => void;
};

/** « 25 » + « min », ou « 1 h 10 » : la durée en valeur de case. */
function DurationValue({ minutes }: { minutes: number }) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return (
    <span className="text-xl leading-7 font-bold tabular-nums">
      {h > 0 ? (
        <>
          {h}
          <span className="mx-0.5 text-sm font-semibold">h</span>
          {m > 0 ? String(m).padStart(2, "0") : null}
        </>
      ) : (
        <>
          {m}
          <span className="ml-0.5 text-sm font-semibold">min</span>
        </>
      )}
    </span>
  );
}

// Popup « détail spectacle », refondu le 2026-10-07 sur le modèle du popup
// attraction : bannière, bandeau de chiffres à cheval dessus, puis les séances
// du jour et le rappel en une ligne. Pas de graphique : un spectacle n'a pas
// de file.
export default function ShowDetailDialog({
  target,
  parkIdentifier,
  parkName,
  timezone,
  onOpenChange,
}: ShowDetailDialogProps) {
  const t = useTranslations("showDetail");
  const tShows = useTranslations("shows");
  const tAttraction = useTranslations("attractionDetail");
  const { is12Hour } = useTimeFormat();
  const fmt = getLuxonFormat(is12Hour);
  const slots = useShowSlots(
    target?.schedules ?? [],
    target?.duration ?? 0,
    timezone,
  );

  // Une plage d'ACCÈS CONTINU (Puy du Fou 12:00–20:15) n'est pas une séance :
  // elle se lit comme un lieu ouvert, avec son état et son heure de fermeture.
  // `duration` seul induirait en erreur (cf. getShowAccessInfo).
  const access = target ? getShowAccessInfo(target, timezone) : null;
  const time = (iso: string) =>
    DateTime.fromISO(iso, { zone: timezone }).toFormat(fmt);

  const next = slots.find((s) => s.state === "upcoming");
  const ongoing = slots.find((s) => s.state === "ongoing");
  const remaining = slots.filter((s) => s.state === "upcoming").length;

  let strip: React.ReactNode;
  if (access?.kind === "continuous") {
    const state = ongoing ? "ongoing" : next ? "upcoming" : "past";
    strip = (
      <StatStrip>
        <Stat label={t("liveAccess")}>
          <StatusValue
            status={state === "ongoing" ? "open" : "closed"}
            label={
              state === "ongoing"
                ? tShows("legendOngoing")
                : state === "upcoming"
                  ? tShows("legendUpcoming")
                  : tShows("legendPast")
            }
          />
        </Stat>
        {state !== "past" && (
          <Stat
            label={
              state === "ongoing"
                ? tAttraction("liveClosesAt")
                : tAttraction("liveOpensAt")
            }
          >
            <StatTime>
              {time(state === "ongoing" ? access.endTime : access.startTime)}
            </StatTime>
          </Stat>
        )}
      </StatStrip>
    );
  } else if (slots.length > 0) {
    strip = (
      <StatStrip>
        <Stat label={t("liveNext")}>
          {next ? (
            <StatTime>{next.label}</StatTime>
          ) : ongoing ? (
            <StatusValue status="open" label={tShows("legendOngoing")} />
          ) : (
            <span className="text-xl leading-7 font-bold text-muted-foreground">
              –
            </span>
          )}
        </Stat>
        {access?.kind === "duration" && (
          <Stat label={t("liveDuration")}>
            <DurationValue minutes={access.minutes} />
          </Stat>
        )}
        <Stat label={t("liveRemaining")}>
          <span className="text-xl leading-7 font-bold tabular-nums">
            {remaining}
            <span className="ml-0.5 text-sm font-semibold text-muted-foreground">
              /{slots.length}
            </span>
          </span>
        </Stat>
      </StatStrip>
    );
  }

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[88dvh] flex-col gap-0 overflow-hidden rounded-4xl border-0 p-0 sm:max-w-md"
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

            {/* En-tête épinglée : bannière (nom, lieu, étoile — namespace
                shows) et, à cheval sur son bas, le bandeau de chiffres. */}
            <div className="shrink-0">
              <ImageSection
                title={target.showName}
                favNamespace="shows"
                favKey={`${parkIdentifier}:${target.showName}`}
                // Le quartier du parc quand la source le publie ; à défaut la
                // SALLE, qui répond à la même question d'un cran plus près
                // (« Amfiteatr Colosseo ») ; rien du tout sinon. 109 des 134
                // spectacles qui nomment une salle n'ont pas de quartier :
                // sans ce repli, ces popups n'indiqueraient jamais où aller.
                place={target.zone ?? target.venue}
                banner={target.banner}
                credit={parkName}
                overlapped={Boolean(strip)}
              />
              {strip && <div className="relative z-10 -mt-10 px-4">{strip}</div>}
            </div>

            {/* Corps défilant : séances du jour + rappel. `key` : changer de
                spectacle sans fermer le popup repart d'un rappel replié. */}
            <div
              key={target.showName}
              className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pt-5 pb-5 scrollbar-hide *:shrink-0"
            >
              {/* Peur et prix d'une maison hantée, quand la source les
                  publie (les parcs CDA) — rien sinon. */}
              <PoiFacts fearLevel={target.fearLevel} price={target.price} />
              {/* Un spectacle d'événement SANS séance publiée (les maisons de
                  Bellewaerde) : ni grille ni rappel, qui diraient « plus de
                  représentation aujourd'hui » — faux, on n'en sait rien. */}
              {target.schedules.length > 0 ? (
                <ShowSchedulePanel
                  parkIdentifier={parkIdentifier}
                  parkName={parkName}
                  showName={target.showName}
                  slots={slots}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("noSchedule")}
                </p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
