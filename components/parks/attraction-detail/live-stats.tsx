"use client";

import { Children } from "react";
import { useTranslations } from "next-intl";
import { DateTime } from "luxon";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { cn, getLuxonFormat } from "@/lib/utils";
import { formatWaitMinutes, type WaitCap } from "@/lib/wait-time-cap";
import type { PoiHoursSlot } from "@/types/poiHours";
import type { QueueTime } from "@/types/waitTime";

// Mêmes paliers que `getWaitTimeBadge` : un même temps ne peut pas être vert
// dans la liste et orange dans le popup. Teinte -400 en sombre (le fond de
// pastille -100 était trop pâle pour un chiffre de cette taille, la -500 un peu
// sourde), -600 en clair.
function waitTone(minutes: number): string {
  if (minutes <= 20) return "text-green-600 dark:text-green-400";
  if (minutes <= 40) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

// ⚠️ **L'état reprend les couleurs de sa PASTILLE** (`getStatusBadge`) : en
// sombre le FOND de la pastille (green-100…), en clair son TEXTE, qui seul
// reste lisible sur blanc. Point compris.
const STATUS_TONE: Record<string, { text: string; dot: string }> = {
  open: { text: "text-green-700 dark:text-green-100", dot: "bg-green-400" },
  down: { text: "text-orange-700 dark:text-orange-100", dot: "bg-orange-300" },
  closed: { text: "text-red-700 dark:text-red-100", dot: "bg-red-400" },
  maintenance: { text: "text-red-700 dark:text-red-100", dot: "bg-red-400" },
};

type HoursCell = { label: "liveOpensAt" | "liveClosesAt" | "liveClosedAt"; at: string };

/**
 * Ce que les horaires du jour disent À CET INSTANT, en une valeur : l'heure de
 * fermeture du créneau en cours, sinon l'ouverture du prochain, sinon la
 * fermeture du dernier. Un créneau coupé (pause déjeuner) se lit ainsi sans
 * afficher toute la liste.
 */
function hoursCell(slots: PoiHoursSlot[], nowMs: number): HoursCell {
  for (const slot of slots) {
    const open = Date.parse(slot.openTime);
    const close = Date.parse(slot.closeTime);
    if (nowMs < open) return { label: "liveOpensAt", at: slot.openTime };
    if (nowMs < close) return { label: "liveClosesAt", at: slot.closeTime };
  }
  return { label: "liveClosedAt", at: slots[slots.length - 1].closeTime };
}

/**
 * Le bandeau de chiffres du popup attraction : attente, état et horaires, côte
 * à côte, posé à cheval sur le bas de la bannière.
 *
 * ⚠️ **Dans l'en-tête ÉPINGLÉE, pas dans le corps défilant** : le chevauchement
 * de la photo se fait par une marge négative, que le conteneur à défilement
 * (`overflow-y-auto`) rognerait. Et c'est l'information qu'on vient chercher :
 * elle doit rester visible quand on fait défiler le graphique.
 *
 * Sans horaires connus pour l'attraction, la troisième colonne disparaît.
 */
export default function LiveStats({
  queue,
  hours,
  waitCap,
  showWait = true,
}: {
  queue: QueueTime | undefined;
  hours: { slots: PoiHoursSlot[]; timezone: string } | null;
  waitCap: WaitCap | null;
  // Colonne « Attente » : toujours pour une attraction, jamais pour un
  // restaurant ou une boutique dont la source ne publie qu'un témoin
  // ouvert/fermé (voir `showsWaitTime` dans `lib/poi-kinds.ts`).
  showWait?: boolean;
}) {
  const t = useTranslations("attractionDetail");
  const tStatus = useTranslations("attractionStatus");
  const { is12Hour } = useTimeFormat();
  const format = getLuxonFormat(is12Hour);

  const cell = hours ? hoursCell(hours.slots, Date.now()) : null;
  const time = (iso: string, zone: string) =>
    DateTime.fromISO(iso, { zone }).toFormat(format);
  // Créneau de file virtuelle, publié en « HH:mm » heure du parc.
  const slotTime = (hhmm: string) => {
    const parsed = DateTime.fromFormat(hhmm, "HH:mm");
    return parsed.isValid ? parsed.toFormat(format) : hhmm;
  };

  const waitMinutes =
    queue && queue.status === "open" && queue.waitTime >= 0
      ? queue.waitTime
      : null;

  if (!queue && !cell) return null;

  return (
    <StatStrip>
      {queue && showWait && (
        <Stat label={t("liveWait")}>
          {queue.timeSlot ? (
            // File virtuelle : un créneau de passage, pas une durée.
            <span className="text-[15px] font-semibold leading-7 whitespace-nowrap text-sky-600 dark:text-sky-400">
              {slotTime(queue.timeSlot.start)}–{slotTime(queue.timeSlot.end)}
            </span>
          ) : waitMinutes != null ? (
            <span
              className={cn(
                "text-[26px] leading-7 font-bold tabular-nums",
                waitTone(waitMinutes),
              )}
            >
              {formatWaitMinutes(waitMinutes, waitCap)}
              <span className="ml-0.5 text-sm font-semibold">min</span>
            </span>
          ) : (
            <span className="text-[26px] leading-7 font-bold text-muted-foreground">
              –
            </span>
          )}
        </Stat>
      )}
      {queue && (
        <Stat label={t("liveStatus")}>
          <StatusValue status={queue.status} label={tStatus(queue.status)} />
        </Stat>
      )}
      {cell && hours && (
        <Stat label={t(cell.label)}>
          <StatTime>{time(cell.at, hours.timezone)}</StatTime>
        </Stat>
      )}
    </StatStrip>
  );
}

const GRID_COLS = ["grid-cols-1", "grid-cols-1", "grid-cols-2", "grid-cols-3"];

/**
 * Le bandeau lui-même, partagé par les popups attraction, spectacle et POI :
 * une case par enfant, colonnes égales. Les enfants `null`/`false` ne comptent
 * pas — une case absente ne laisse pas de trou.
 */
export function StatStrip({ children }: { children: React.ReactNode }) {
  const count = Children.toArray(children).length;
  if (count === 0) return null;
  return (
    <div
      className={cn(
        // `bg-card` et non `bg-background` : en sombre, le fond du popup est
        // quasi noir, et le bandeau doit s'en détacher en gris très foncé.
        "grid divide-x divide-border rounded-3xl border bg-card/85 shadow-lg shadow-black/25 backdrop-blur-md",
        GRID_COLS[Math.min(count, 3)],
      )}
    >
      {children}
    </div>
  );
}

export function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 px-3.5 py-3">
      <span className="truncate text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

/** Une heure en valeur de case (« 17:00 »). */
export function StatTime({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xl leading-7 font-bold tabular-nums">{children}</span>
  );
}

/**
 * Un état en valeur de case : point coloré + libellé. Ouvert (ou « en cours »
 * pour un spectacle) : le point pulse comme celui du badge « ouvert » du parc
 * (`ParkStatusBadge`).
 */
export function StatusValue({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  return (
    <span
      className={cn(
        "flex h-7 items-center gap-2 text-base font-semibold",
        STATUS_TONE[status]?.text,
      )}
    >
      <span className="relative size-2 shrink-0">
        <span
          className={cn(
            "absolute inset-0 rounded-full",
            STATUS_TONE[status]?.dot ?? "bg-muted-foreground",
          )}
        />
        {status === "open" && (
          <span className="absolute inset-0 animate-ping rounded-full bg-green-400" />
        )}
      </span>
      <span className="truncate">{label}</span>
    </span>
  );
}
