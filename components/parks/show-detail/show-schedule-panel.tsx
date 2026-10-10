"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { DateTime } from "luxon";
import { useTranslations } from "next-intl";
import {
  Bell,
  BellOff,
  BellRing,
  ChevronRight,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import NumberStepper from "@/components/ui/number-stepper";
import { cn, getLuxonFormat } from "@/lib/utils";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { useUser } from "@/components/providers/user-provider";
import { useNotifications } from "@/components/providers/notifications-provider";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import NotificationGate from "@/components/parks/notification-gate";
import type { ShowSchedule } from "@/types/show";
import type { ShowReminderDTO } from "@/types/user";
import { availableLeadValues } from "@/lib/reminder-leads";

// Délai proposé par défaut (minutes avant le début du créneau). Les délais
// PROPOSÉS dépendent du temps restant (voir `availableLeadValues`) : on
// n'affiche jamais un délai qui se déclencherait déjà dans le passé.
const DEFAULT_LEAD = 30;
// Durée de repli (min) quand ni durée de spectacle ni fin de créneau ne sont
// connues : sert uniquement à situer « terminé / en cours / à venir ».
const FALLBACK_DURATION = 30;

export type SlotState = "past" | "ongoing" | "upcoming";

export type ShowSlot = {
  iso: string;
  ms: number;
  endMs: number;
  label: string;
  state: SlotState;
};

/**
 * Les représentations du jour, triées, avec leur état à l'instant. Partagé par
 * le bandeau du popup (prochaine séance, séances restantes) et la grille des
 * séances : les deux doivent compter la même chose.
 */
export function useShowSlots(
  schedules: ShowSchedule[],
  duration: number,
  timezone: string,
): ShowSlot[] {
  const { is12Hour } = useTimeFormat();
  return useMemo(() => {
    const now = Date.now();
    const durMs = (duration > 0 ? duration : FALLBACK_DURATION) * 60_000;
    return schedules
      .map((s) => {
        const start = DateTime.fromISO(s.startTime, { zone: timezone });
        const ms = start.toMillis();
        const endMs = s.endTime
          ? DateTime.fromISO(s.endTime, { zone: timezone }).toMillis()
          : ms + durMs;
        const state: SlotState =
          endMs <= now ? "past" : ms <= now ? "ongoing" : "upcoming";
        return {
          iso: s.startTime,
          ms,
          endMs,
          label: start.toFormat(getLuxonFormat(is12Hour)),
          state,
        };
      })
      .sort((a, b) => a.ms - b.ms);
  }, [schedules, timezone, is12Hour, duration]);
}

// Même forme que la ligne d'alerte du popup attraction (`alert-section.tsx`).
const ROW =
  "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left";
const ICON_TILE = "grid size-8 shrink-0 place-items-center rounded-lg";

type ShowSchedulePanelProps = {
  parkIdentifier: string;
  parkName: string;
  showName: string;
  slots: ShowSlot[];
};

/**
 * Les séances du jour et les rappels d'un spectacle, refondus le 2026-10-07 sur
 * le modèle du popup attraction : la grille des séances TOUJOURS visible sous
 * le titre « Aujourd'hui » (elle était cachée derrière la connexion), puis le
 * rappel réduit à UNE LIGNE qui se déplie en carte de réglage.
 *
 * Un clic sur une séance à venir déplie la carte sur cette séance ; une fois
 * dépliée, la grille sert de sélecteur. Un seul rappel par représentation : la
 * cloche sur une séance dit qu'elle en a un.
 */
export default function ShowSchedulePanel({
  parkIdentifier,
  parkName,
  showName,
  slots,
}: ShowSchedulePanelProps) {
  const t = useTranslations("showDetail");
  const tShows = useTranslations("shows");
  const tAttraction = useTranslations("attractionDetail");
  const { isAuthenticated } = useUser();
  // Rafraîchit la cloche « rappel programmé » affichée sur la ligne de la liste.
  const { refresh: refreshNotifications } = useNotifications();
  const push = usePushNotifications();

  const [reminders, setReminders] = useState<ShowReminderDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // Instant (millis) de la séance sélectionnée, ou null.
  const [selected, setSelected] = useState<number | null>(null);
  const [lead, setLead] = useState(DEFAULT_LEAD);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Rappels existants, dès l'ouverture du popup : ce sont eux qui posent la
  // cloche sur les séances et le compte sur la ligne repliée. Rien sans compte.
  useEffect(() => {
    if (!isAuthenticated) {
      setReminders([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    axios
      .get<ShowReminderDTO[]>("/api/user/show-reminders", {
        params: { parkIdentifier, showName },
      })
      .then((res) => {
        if (!cancelled) setReminders(res.data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [parkIdentifier, showName, isAuthenticated]);

  // Index des rappels existants par instant (millis) de la séance.
  const reminderByMs = useMemo(() => {
    const map = new Map<number, ShowReminderDTO>();
    for (const r of reminders) {
      map.set(DateTime.fromISO(r.startTime).toMillis(), r);
    }
    return map;
  }, [reminders]);

  const upcoming = slots.filter((s) => s.state === "upcoming");
  const selectedSlot = slots.find((s) => s.ms === selected) ?? null;
  const existing = selected !== null ? reminderByMs.get(selected) : undefined;

  // Délais encore valides pour la séance sélectionnée (déclenchement pas déjà
  // passé). IMPORTANT : évalués sur l'INSTANT ABSOLU de la séance (`ms`, déjà
  // calculé dans le fuseau du parc), pas sur `iso` (sans fuseau) qui serait
  // ré-interprété dans le fuseau du navigateur.
  const leadOptions = selectedSlot
    ? availableLeadValues(new Date(selectedSlot.ms))
    : [];
  const leadTooLate =
    selectedSlot?.state === "upcoming" && leadOptions.length === 0;

  const select = (ms: number) => {
    setSelected(ms);
    const opts = availableLeadValues(new Date(ms));
    const desired = reminderByMs.get(ms)?.leadMinutes ?? DEFAULT_LEAD;
    // Repli sur le plus long délai encore possible si le souhaité est exclu.
    setLead(
      opts.includes(desired)
        ? desired
        : opts.length > 0
          ? opts[opts.length - 1]
          : desired,
    );
  };

  // Déplie la carte, sur la séance touchée, ou sur la première séance à venir
  // qui a déjà un rappel, à défaut la première à venir.
  const open = (ms?: number) => {
    const target =
      ms ??
      upcoming.find((s) => reminderByMs.has(s.ms))?.ms ??
      upcoming[0]?.ms;
    if (target != null) select(target);
    setExpanded(true);
  };

  const save = async () => {
    if (!selectedSlot) return;
    setSaving(true);
    try {
      // Le clic « Activer » est le geste utilisateur qui autorise la demande de
      // permission : on s'abonne au push si ce n'est pas déjà fait.
      let pushOk = push.subscribed;
      if (push.supported && !push.subscribed) {
        pushOk = await push.subscribe();
      }

      const { data } = await axios.post<ShowReminderDTO>(
        "/api/user/show-reminders",
        {
          parkIdentifier,
          parkName,
          showName,
          startTime: selectedSlot.iso,
          leadMinutes: lead,
        },
      );
      setReminders((prev) => [...prev.filter((r) => r.id !== data.id), data]);
      setExpanded(false);
      refreshNotifications();

      if (push.supported && !pushOk) {
        toast.warning(t("pushBlocked"));
      } else {
        toast.success(t("reminderSaved"));
      }
    } catch {
      toast.error(t("reminderError"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/user/show-reminders/${existing.id}`);
      setReminders((prev) => prev.filter((r) => r.id !== existing.id));
      refreshNotifications();
      setLead(DEFAULT_LEAD);
      toast.success(t("reminderRemoved"));
    } catch {
      toast.error(t("reminderError"));
    } finally {
      setDeleting(false);
    }
  };

  // Couleurs alignées sur la légende de la timeline (terminé / en cours / à
  // venir). La sélection ne se voit que carte dépliée : repliée, rien n'est en
  // cours de réglage.
  const slotClasses = (state: SlotState, isSelected: boolean) => {
    if (state === "past") {
      return "border-border bg-muted/50 text-muted-foreground/60 cursor-default";
    }
    if (state === "ongoing") {
      return "border-dashed border-primary/30 bg-primary/10 text-primary cursor-default";
    }
    return isSelected
      ? "border-primary bg-primary text-primary-foreground"
      : "border-primary/30 bg-primary/20 text-primary hover:border-primary/60";
  };

  const remindersAhead = upcoming.filter((s) => reminderByMs.has(s.ms)).length;

  return (
    <>
      {/* ————— Aujourd'hui : toutes les séances, légende en tête ————— */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="text-[15px] font-semibold">
            {tAttraction("chartToday")}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-3 rounded-sm border border-border bg-muted/50" />
              {tShows("legendPast")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-3 rounded-sm border border-dashed border-primary/30 bg-primary/10" />
              {tShows("legendOngoing")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-3 rounded-sm border border-primary/30 bg-primary/20" />
              {tShows("legendUpcoming")}
            </span>
          </div>
        </div>

        {slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noUpcoming")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => {
              const hasReminder = reminderByMs.has(s.ms);
              const isSelected = expanded && s.ms === selected;
              return (
                <button
                  key={s.iso}
                  type="button"
                  disabled={s.state !== "upcoming"}
                  onClick={() => open(s.ms)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium tabular-nums transition-colors",
                    slotClasses(s.state, isSelected),
                  )}
                >
                  {hasReminder && <BellRing className="size-3.5" />}
                  {s.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ————— Le rappel ————— */}
      {upcoming.length === 0 ? (
        // Plus rien à venir : la ligne reste, inerte, et dit pourquoi.
        slots.length > 0 && (
          <div
            className={cn(ROW, "border-dashed text-muted-foreground")}
          >
            <span className={cn(ICON_TILE, "bg-muted")}>
              <BellOff className="size-4" />
            </span>
            <p className="min-w-0 flex-1 text-sm">{t("noUpcoming")}</p>
          </div>
        )
      ) : !expanded ? (
        <button
          type="button"
          onClick={() => open()}
          disabled={loading}
          className={cn(
            ROW,
            remindersAhead > 0
              ? "border-primary/35 bg-primary/10"
              : "bg-muted/40 transition-colors hover:bg-muted",
            "disabled:opacity-60",
          )}
        >
          <span
            className={cn(
              ICON_TILE,
              remindersAhead > 0
                ? "bg-primary text-primary-foreground"
                : "bg-primary/15 text-primary",
            )}
          >
            {remindersAhead > 0 ? (
              <BellRing className="size-4" />
            ) : (
              <Bell className="size-4" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              {remindersAhead > 0
                ? t("reminderRowCount", { count: remindersAhead })
                : t("reminderRowTitle")}
            </span>
            <span className="block text-xs text-muted-foreground">
              {!isAuthenticated
                ? tAttraction("alertRowSignIn")
                : remindersAhead > 0
                  ? t("reminderRowEdit")
                  : t("reminderRowPick")}
            </span>
          </span>
          {loading ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          )}
        </button>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border bg-muted/40 p-3">
          <div className="flex items-center gap-3">
            <span className={cn(ICON_TILE, "bg-primary/15 text-primary")}>
              <Bell className="size-4" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
              {selectedSlot
                ? t("reminderSlot", { time: selectedSlot.label })
                : t("reminderRowTitle")}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpanded(false)}
              aria-label={tAttraction("close")}
              className="text-muted-foreground"
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Séquence installer/se connecter mutualisée avec les alertes
              d'attraction, ici sans cadre : la carte en tient lieu. */}
          <NotificationGate plain signInIntro={t("signInIntro")}>
            {leadTooLate ? (
              <p className="text-sm text-muted-foreground">
                {t("leadTooLate")}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <NumberStepper
                  value={lead}
                  onChange={setLead}
                  values={leadOptions}
                  format={(v) => t("leadOption", { minutes: v })}
                  aria-label={t("leadLabel")}
                  className="w-full justify-between"
                />
                <p className="text-center text-xs text-muted-foreground">
                  {t("reminderPickHint")}
                </p>
              </div>
            )}

            <div className="flex w-full gap-2">
              <Button
                onClick={save}
                disabled={
                  saving ||
                  leadTooLate ||
                  !selectedSlot ||
                  (!!existing && existing.leadMinutes === lead)
                }
                className="flex-1"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                {existing ? t("reminderModify") : t("reminderActivate")}
              </Button>
              {existing && (
                // Même corbeille que le popup d'attraction et que le fil du
                // profil : bouton fantôme teinté en destructif.
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={remove}
                  disabled={deleting}
                  aria-label={t("remove")}
                  className="text-destructive hover:text-destructive"
                >
                  {deleting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              )}
            </div>
          </NotificationGate>
        </div>
      )}
    </>
  );
}
