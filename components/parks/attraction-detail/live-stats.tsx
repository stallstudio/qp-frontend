"use client";

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
}: {
  queue: QueueTime | undefined;
  hours: { slots: PoiHoursSlot[]; timezone: string } | null;
  waitCap: WaitCap | null;
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
    <div
      className={cn(
        // `bg-card` et non `bg-background` : en sombre, le fond du popup est
        // quasi noir, et le bandeau doit s'en détacher en gris très foncé.
        "grid divide-x divide-border rounded-3xl border bg-card/85 shadow-lg shadow-black/25 backdrop-blur-md",
        cell && queue ? "grid-cols-3" : cell || queue ? "grid-cols-2" : "",
      )}
    >
      {queue && (
        <>
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
          <Stat label={t("liveStatus")}>
            <span
              className={cn(
                "flex h-7 items-center gap-2 text-base font-semibold",
                STATUS_TONE[queue.status]?.text,
              )}
            >
              {/* Ouvert : le point pulse comme celui du badge « ouvert » du parc
                  (`ParkStatusBadge`). */}
              <span className="relative size-2 shrink-0">
                <span
                  className={cn(
                    "absolute inset-0 rounded-full",
                    STATUS_TONE[queue.status]?.dot ?? "bg-muted-foreground",
                  )}
                />
                {queue.status === "open" && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-green-400" />
                )}
              </span>
              <span className="truncate">{tStatus(queue.status)}</span>
            </span>
          </Stat>
        </>
      )}
      {cell && hours && (
        <Stat label={t(cell.label)}>
          <span className="text-xl leading-7 font-bold tabular-nums">
            {time(cell.at, hours.timezone)}
          </span>
        </Stat>
      )}
    </div>
  );
}

function Stat({
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
