"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { DateTime } from "luxon";
import { useTranslations } from "next-intl";
import { BellRing, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import NumberStepper from "@/components/ui/number-stepper";
import { cn, getLuxonFormat } from "@/lib/utils";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import type { ShowSchedule } from "@/types/show";
import type { ShowReminderDTO } from "@/types/user";

// Délais proposés (minutes avant le début du créneau).
const LEAD_VALUES = [10, 20, 30, 40, 50, 60];
const DEFAULT_LEAD = 30;
// Durée de repli (min) quand ni durée de spectacle ni fin de créneau ne sont
// connues : sert uniquement à situer « terminé / en cours / à venir ».
const FALLBACK_DURATION = 30;

type SlotState = "past" | "ongoing" | "upcoming";

type ReminderSectionProps = {
  parkIdentifier: string;
  parkName: string;
  showName: string;
  duration: number;
  schedules: ShowSchedule[];
  timezone: string;
};

// Rappels programmés d'un spectacle : TOUS les créneaux du jour sont affichés en
// vignettes centrées, colorées comme la légende de la timeline (terminé / en cours
// / à venir). Un clic sur un créneau À VENIR permet de choisir un délai (10–60 min)
// avant lequel recevoir une notification. Un seul rappel par représentation.
export default function ReminderSection({
  parkIdentifier,
  parkName,
  showName,
  duration,
  schedules,
  timezone,
}: ReminderSectionProps) {
  const t = useTranslations("showDetail");
  const tShows = useTranslations("shows");
  const { is12Hour } = useTimeFormat();
  const push = usePushNotifications();

  const [reminders, setReminders] = useState<ShowReminderDTO[]>([]);
  const [loading, setLoading] = useState(true);
  // Instant (millis) du créneau sélectionné, ou null.
  const [selected, setSelected] = useState<number | null>(null);
  const [lead, setLead] = useState(DEFAULT_LEAD);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Tous les créneaux du jour, triés, avec leur état (terminé / en cours / à venir).
  const slots = useMemo(() => {
    const now = Date.now();
    const durMs = (duration > 0 ? duration : FALLBACK_DURATION) * 60_000;
    return schedules
      .map((s) => {
        const start = DateTime.fromISO(s.startTime, { zone: timezone });
        const startMs = start.toMillis();
        const endMs = s.endTime
          ? DateTime.fromISO(s.endTime, { zone: timezone }).toMillis()
          : startMs + durMs;
        const state: SlotState =
          endMs <= now ? "past" : startMs <= now ? "ongoing" : "upcoming";
        return {
          iso: s.startTime,
          ms: startMs,
          label: start.toFormat(getLuxonFormat(is12Hour)),
          state,
        };
      })
      .sort((a, b) => a.ms - b.ms);
  }, [schedules, timezone, is12Hour, duration]);

  // Index des rappels existants par instant (millis) du créneau.
  const reminderByMs = useMemo(() => {
    const map = new Map<number, ShowReminderDTO>();
    for (const r of reminders) {
      map.set(DateTime.fromISO(r.startTime).toMillis(), r);
    }
    return map;
  }, [reminders]);

  // Charge les rappels existants de ce spectacle (pré-remplit les vignettes).
  useEffect(() => {
    let cancelled = false;
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
  }, [parkIdentifier, showName]);

  const selectedSlot = slots.find((s) => s.ms === selected) ?? null;
  const existing = selected !== null ? reminderByMs.get(selected) : undefined;

  // Seuls les créneaux à venir sont programmables.
  const selectSlot = (ms: number, state: SlotState) => {
    if (state !== "upcoming") return;
    setSelected(ms);
    const r = reminderByMs.get(ms);
    setLead(r ? r.leadMinutes : DEFAULT_LEAD);
  };

  const save = async () => {
    if (!selectedSlot) return;
    setSaving(true);
    try {
      // Le clic « Enregistrer » est le geste utilisateur qui autorise la demande
      // de permission : on s'abonne au push si ce n'est pas déjà fait.
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
      setLead(DEFAULT_LEAD);
      toast.success(t("reminderRemoved"));
    } catch {
      toast.error(t("reminderError"));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <p className="py-2 text-center text-sm text-muted-foreground">
        {t("noUpcoming")}
      </p>
    );
  }

  // Couleurs alignées sur la légende de la timeline (terminé / en cours / à venir).
  const slotClasses = (state: SlotState, selected: boolean) => {
    if (state === "past") {
      return "border-border bg-muted/50 text-muted-foreground/60 cursor-default";
    }
    if (state === "ongoing") {
      return "border-dashed border-primary/30 bg-primary/10 text-primary cursor-default";
    }
    // upcoming
    return selected
      ? "border-primary bg-primary text-primary-foreground"
      : "border-primary/30 bg-primary/20 text-primary hover:border-primary/60";
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t("reminderIntro")}</p>

      {/* Toutes les représentations du jour, centrées. Cloche = rappel programmé. */}
      <div className="flex flex-wrap justify-center gap-2">
        {slots.map((s) => {
          const hasReminder = reminderByMs.has(s.ms);
          const isSelected = s.ms === selected;
          return (
            <button
              key={s.iso}
              type="button"
              disabled={s.state !== "upcoming"}
              onClick={() => selectSlot(s.ms, s.state)}
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

      {/* Légende (mêmes couleurs que la timeline) pour lire les états. */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm border border-border bg-muted/50" />
          {tShows("legendPast")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm border border-dashed border-primary/30 bg-primary/10" />
          {tShows("legendOngoing")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm border border-primary/30 bg-primary/20" />
          {tShows("legendUpcoming")}
        </span>
      </div>

      {/* Sélecteur de délai + actions, une fois un créneau À VENIR sélectionné. */}
      {selectedSlot && selectedSlot.state === "upcoming" && (
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-3">
          <span className="text-center text-sm font-medium">
            {t("leadLabel")}
          </span>
          <NumberStepper
            value={lead}
            onChange={setLead}
            values={LEAD_VALUES}
            format={(v) => t("leadOption", { minutes: v })}
            aria-label={t("leadLabel")}
          />
          {existing && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <BellRing className="size-3.5" />
              {t("reminderActive", { minutes: existing.leadMinutes })}
            </span>
          )}
          <div className="flex w-full gap-2">
            <Button
              onClick={save}
              disabled={saving || (!!existing && existing.leadMinutes === lead)}
              className="flex-1"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {existing ? t("update") : t("save")}
            </Button>
            {existing && (
              <Button
                variant="outline"
                size="icon"
                onClick={remove}
                disabled={deleting}
                aria-label={t("remove")}
              >
                {deleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
