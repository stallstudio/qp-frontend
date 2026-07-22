"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { DateTime } from "luxon";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import {
  Bell,
  BellRing,
  BellOff,
  Drama,
  Pencil,
  RollerCoaster,
  Trash2,
  Loader2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import NumberStepper from "@/components/ui/number-stepper";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ALERT_THRESHOLDS } from "@/lib/alert-thresholds";
import {
  REMINDER_LEAD_VALUES,
  availableLeadValues,
} from "@/lib/reminder-leads";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { useUser } from "@/components/providers/user-provider";
import type { AlertDTO, ShowReminderDTO } from "@/types/user";
import AlertHistoryFeed from "./alert-history-section";

// Onglet « Alertes » du profil — DIRECTION « fil unifié » :
//   • un seul fil sur toute la largeur (plus de colonnes qui ne s'alignent pas) ;
//   • deux sous-onglets Actives / Historique (segment compact, aligné à gauche
//     comme le tri de l'accueil) ;
//   • filtres Tout · Attractions · Spectacles — le type est un attribut de ligne
//     (pastille + accent : orange pour les attractions, violet pour les
//     spectacles), et les deux types sont mélangés puis triés par ordre
//     alphabétique.
// La CRÉATION ne se fait jamais ici (toujours depuis le popup d'une attraction /
// d'un spectacle).

type TypeFilter = "all" | "rides" | "shows";
type SubTab = "active" | "history";

// Élément actif normalisé (attraction OU spectacle), pour un fil mélangé trié
// par titre.
type ActiveItem =
  | { kind: "ride"; id: string; sortKey: string; alert: AlertDTO }
  | { kind: "show"; id: string; sortKey: string; reminder: ShowReminderDTO };

// Sous-onglets Actives / Historique : segment compact avec pastille coulissante
// (même glissement que le tri de l'accueil / les onglets du profil). Deux
// cellules égales (grid-cols-2) pour que la pastille à 50% tombe juste malgré
// des libellés de longueurs différentes.
function SubTabs({
  value,
  onChange,
  activeLabel,
  historyLabel,
}: {
  value: SubTab;
  onChange: (v: SubTab) => void;
  activeLabel: string;
  historyLabel: string;
}) {
  return (
    <div className="relative grid grid-cols-2 rounded-xl border bg-muted p-[3px] text-sm">
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-[3px] left-[3px] top-[3px] w-[calc(50%-3px)] rounded-lg bg-background shadow-sm dark:border dark:border-input dark:bg-input/30"
        style={{
          transform:
            value === "history" ? "translateX(100%)" : "translateX(0%)",
          transitionProperty: "transform",
          transitionDuration: "500ms",
          transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      />
      {(
        [
          ["active", activeLabel],
          ["history", historyLabel],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`relative z-10 cursor-pointer rounded-lg px-4 py-1.5 font-medium transition-colors ${
            value === key ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// Puces de filtre par type (Tout · Attractions · Spectacles) : pastille de
// couleur du type, accent propre à l'état actif (neutre / orange / violet).
function TypeChips({
  value,
  onChange,
  labels,
}: {
  value: TypeFilter;
  onChange: (v: TypeFilter) => void;
  labels: Record<TypeFilter, string>;
}) {
  const items: {
    key: TypeFilter;
    icon?: React.ReactNode;
    iconColor?: string;
  }[] = [
    { key: "all" },
    {
      key: "rides",
      icon: <RollerCoaster className="size-3.5" />,
      iconColor: "text-primary",
    },
    { key: "shows", icon: <Drama className="size-3.5" />, iconColor: "text-show" },
  ];
  const activeClass: Record<TypeFilter, string> = {
    all: "border-foreground bg-foreground text-background",
    rides: "border-primary bg-primary text-primary-foreground",
    shows: "border-show bg-show text-show-foreground",
  };
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(({ key, icon, iconColor }) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? activeClass[key]
                : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {/* Icône du type : teintée (orange / violet) au repos, elle suit la
                couleur du texte quand la puce est active. */}
            {icon && (
              <span className={active ? "" : iconColor}>{icon}</span>
            )}
            {labels[key]}
          </button>
        );
      })}
    </div>
  );
}

// Pastille (icône) : carré à bords arrondis, teinté selon le type.
function Avatar({
  kind,
  children,
}: {
  kind: "ride" | "show";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
        kind === "show" ? "bg-show/10 text-show" : "bg-primary/10 text-primary"
      }`}
    >
      {children}
    </div>
  );
}

// Badge de valeur (seuil ≤ X / délai X min), en pilule monospace.
function ValueBadge({
  kind,
  children,
}: {
  kind: "ride" | "show";
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border bg-muted px-2.5 py-1 font-mono text-xs font-semibold tabular-nums">
      {kind === "show" && <BellRing className="size-3 text-show" />}
      {children}
    </span>
  );
}

// Ligne unifiée : pastille + intitulé + valeur/contrôles.
function FeedRow({
  kind,
  icon,
  title,
  subtitle,
  trailing,
}: {
  kind: "ride" | "show";
  icon: React.ReactNode;
  title: string;
  subtitle: React.ReactNode;
  trailing: React.ReactNode;
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{
        // `layout` anime SEUL le repositionnement (ne pas combiner avec scale,
        // sinon Motion mesure mal la boîte et la ligne « saute » d'un coup).
        layout: { type: "spring", stiffness: 500, damping: 40 },
        opacity: { duration: 0.15 },
      }}
      className="flex items-center gap-3 rounded-xl border px-3 py-2"
    >
      <Avatar kind={kind}>{icon}</Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">{trailing}</div>
    </motion.li>
  );
}

// Popup d'édition du seuil (même geste que sur la page attraction).
function EditThresholdDialog({
  alert,
  open,
  onOpenChange,
  onSaved,
}: {
  alert: AlertDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (id: string, threshold: number) => void;
}) {
  const t = useTranslations("profile");
  const tAlert = useTranslations("alerts");
  const [threshold, setThreshold] = useState(alert?.threshold ?? 20);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (alert) setThreshold(alert.threshold);
  }, [alert, open]);

  const save = async () => {
    if (!alert) return;
    setSaving(true);
    try {
      await axios.patch(`/api/user/alerts/${alert.id}`, { threshold });
      onSaved(alert.id, threshold);
      toast.success(t("thresholdSaved"));
      onOpenChange(false);
    } catch {
      toast.error(t("updateError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{alert?.rideName}</DialogTitle>
          <DialogDescription>{tAlert("thresholdLabel")}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-2">
          <NumberStepper
            value={threshold}
            onChange={setThreshold}
            values={ALERT_THRESHOLDS}
            disabled={saving}
            format={(v) => tAlert("thresholdOption", { minutes: v })}
            aria-label={tAlert("thresholdLabel")}
          />
        </div>
        <DialogFooter>
          <Button
            onClick={save}
            disabled={saving || threshold === alert?.threshold}
            className="w-full"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {t("validate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Popup d'édition du délai de prévenance d'un rappel de spectacle. Réutilise le
// MÊME endpoint que la page spectacle (POST upsert par parc+spectacle+horaire),
// qui recalcule `fireAt` et réarme le rappel — comportement identique des deux
// côtés.
function EditLeadDialog({
  reminder,
  open,
  onOpenChange,
  onSaved,
}: {
  reminder: ShowReminderDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: ShowReminderDTO) => void;
}) {
  const t = useTranslations("profile");
  const tShow = useTranslations("showDetail");
  const [lead, setLead] = useState(reminder?.leadMinutes ?? 30);
  const [saving, setSaving] = useState(false);

  // Délais encore valides pour CETTE représentation (déclenchement pas déjà
  // passé). On ne propose donc jamais un délai plus long que le temps restant.
  const leadOptions = reminder
    ? availableLeadValues(reminder.startTime)
    : REMINDER_LEAD_VALUES;
  const tooLate = reminder != null && leadOptions.length === 0;

  useEffect(() => {
    if (!reminder) return;
    const opts = availableLeadValues(reminder.startTime);
    // Garde le délai courant s'il est encore valide, sinon retombe sur le plus
    // long encore possible (le stepper ne doit pas pointer une valeur exclue).
    if (opts.includes(reminder.leadMinutes)) setLead(reminder.leadMinutes);
    else if (opts.length > 0) setLead(opts[opts.length - 1]);
  }, [reminder, open]);

  const save = async () => {
    if (!reminder) return;
    setSaving(true);
    try {
      const { data } = await axios.post<ShowReminderDTO>(
        "/api/user/show-reminders",
        {
          parkIdentifier: reminder.parkIdentifier,
          parkName: reminder.parkName,
          showName: reminder.showName,
          startTime: reminder.startTime,
          leadMinutes: lead,
        },
      );
      onSaved(data);
      toast.success(t("leadSaved"));
      onOpenChange(false);
    } catch {
      toast.error(t("updateError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{reminder?.showName}</DialogTitle>
          <DialogDescription>{tShow("leadLabel")}</DialogDescription>
        </DialogHeader>
        {tooLate ? (
          <p className="py-3 text-center text-sm text-muted-foreground">
            {t("leadTooLate")}
          </p>
        ) : (
          <div className="flex justify-center py-2">
            <NumberStepper
              value={lead}
              onChange={setLead}
              values={leadOptions}
              disabled={saving}
              format={(v) => tShow("leadOption", { minutes: v })}
              aria-label={tShow("leadLabel")}
            />
          </div>
        )}
        <DialogFooter>
          <Button
            onClick={save}
            disabled={saving || tooLate || lead === reminder?.leadMinutes}
            className="w-full"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {tShow("reminderModify")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AlertsSection() {
  const t = useTranslations("profile");
  const tAlert = useTranslations("alerts");
  const locale = useLocale();
  const { is12Hour } = useTimeFormat();
  const { refresh } = useUser();

  const [subTab, setSubTab] = useState<SubTab>("active");
  const [filter, setFilter] = useState<TypeFilter>("all");

  const [alerts, setAlerts] = useState<AlertDTO[]>([]);
  // Rappels de spectacle ACTIFS (programmés, pas encore envoyés).
  const [reminders, setReminders] = useState<ShowReminderDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AlertDTO | null>(null);
  // Rappel de spectacle dont on édite le délai de prévenance (null = fermé).
  const [editingReminder, setEditingReminder] = useState<ShowReminderDTO | null>(
    null,
  );

  useEffect(() => {
    Promise.all([
      axios.get<AlertDTO[]>("/api/user/alerts"),
      axios.get<ShowReminderDTO[]>("/api/user/show-reminders"),
    ])
      .then(([alertsRes, remindersRes]) => {
        setAlerts(alertsRes.data);
        // Toutes les lignes en base sont des rappels EN ATTENTE (les envoyés
        // sont passés en historique) : plus de filtre `sent`.
        setReminders(remindersRes.data);
      })
      .catch(() => toast.error(t("loadError")))
      .finally(() => setLoading(false));
  }, [t]);

  const toggleActive = async (alert: AlertDTO) => {
    const next = !alert.active;
    setBusyId(alert.id);
    setAlerts((list) =>
      list.map((a) => (a.id === alert.id ? { ...a, active: next } : a)),
    );
    try {
      await axios.patch(`/api/user/alerts/${alert.id}`, { active: next });
      refresh();
    } catch {
      toast.error(t("updateError"));
      setAlerts((list) =>
        list.map((a) => (a.id === alert.id ? { ...a, active: !next } : a)),
      );
    } finally {
      setBusyId(null);
    }
  };

  const applyThreshold = (id: string, threshold: number) => {
    setAlerts((list) =>
      list.map((a) => (a.id === id ? { ...a, threshold } : a)),
    );
    refresh();
  };

  // Remplace le rappel édité par la version renvoyée (délai + fireAt recalculés).
  const applyLead = (updated: ShowReminderDTO) => {
    setReminders((list) =>
      list.map((r) => (r.id === updated.id ? updated : r)),
    );
  };

  const remove = async (alert: AlertDTO) => {
    setBusyId(alert.id);
    const previous = alerts;
    setAlerts((list) => list.filter((a) => a.id !== alert.id));
    try {
      await axios.delete(`/api/user/alerts/${alert.id}`);
      toast.success(t("deleted"));
      refresh();
    } catch {
      toast.error(t("deleteError"));
      setAlerts(previous);
    } finally {
      setBusyId(null);
    }
  };

  const removeReminder = async (reminder: ShowReminderDTO) => {
    setBusyId(reminder.id);
    const previous = reminders;
    setReminders((list) => list.filter((r) => r.id !== reminder.id));
    try {
      await axios.delete(`/api/user/show-reminders/${reminder.id}`);
      toast.success(t("deleted"));
    } catch {
      toast.error(t("deleteError"));
      setReminders(previous);
    } finally {
      setBusyId(null);
    }
  };

  const formatTime = (iso: string) =>
    DateTime.fromISO(iso)
      .setLocale(locale)
      .toLocaleString({
        ...DateTime.TIME_SIMPLE,
        hourCycle: is12Hour ? "h12" : "h23",
      });

  // Fusion attractions + spectacles → un seul fil, filtré par type puis trié
  // par ordre alphabétique du nom.
  const activeItems = useMemo<ActiveItem[]>(() => {
    const rideItems: ActiveItem[] =
      filter === "shows"
        ? []
        : alerts.map((a) => ({
            kind: "ride",
            id: a.id,
            sortKey: a.rideName,
            alert: a,
          }));
    const showItems: ActiveItem[] =
      filter === "rides"
        ? []
        : reminders.map((r) => ({
            kind: "show",
            id: r.id,
            sortKey: r.showName,
            reminder: r,
          }));
    return [...rideItems, ...showItems].sort((a, b) =>
      a.sortKey.localeCompare(b.sortKey, locale),
    );
  }, [alerts, reminders, filter, locale]);

  const activeEmptyLabel =
    filter === "rides"
      ? t("alertsEmptyRides")
      : filter === "shows"
        ? t("alertsEmptyShows")
        : t("activeEmptyAll");

  const filterLabels: Record<TypeFilter, string> = {
    all: t("filterAll"),
    rides: t("historyAttractions"),
    shows: t("historyShows"),
  };

  const heading = (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-primary">
        <Bell className="size-4" />
      </span>
      <h2 className="text-lg font-semibold tracking-tight">
        {t("alertsHeading", { count: alerts.length + reminders.length })}
      </h2>
    </div>
  );

  return (
    <>
      {heading}

      {/* Barre d'outils : filtres par type à gauche, sous-onglets Actives /
          Historique poussés à droite (`ml-auto`). Se replient si étroit. */}
      <div className="flex flex-wrap items-center gap-3">
        <TypeChips value={filter} onChange={setFilter} labels={filterLabels} />
        <div className="ml-auto">
          <SubTabs
            value={subTab}
            onChange={setSubTab}
            activeLabel={t("subTabActive")}
            historyLabel={t("subTabHistory")}
          />
        </div>
      </div>

      {subTab === "active" ? (
        <div className="mt-3">
          {/* Rappel : alertes et rappels ne valent que pour la journée en cours. */}
          <p className="mb-3 text-sm text-muted-foreground">
            {t("alertsDailyNote")}
          </p>

          {loading ? (
            <div className="flex justify-center py-6 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : activeItems.length === 0 ? (
            <p className="rounded-xl border border-dashed py-6 text-center text-sm text-muted-foreground">
              {activeEmptyLabel}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              <AnimatePresence initial={false} mode="popLayout">
                {activeItems.map((item) =>
                  item.kind === "ride" ? (
                  <FeedRow
                    key={item.id}
                    kind="ride"
                    icon={<RollerCoaster className="size-4" />}
                    title={item.alert.rideName}
                    subtitle={item.alert.parkName}
                    trailing={
                      <>
                        <ValueBadge kind="ride">
                          <span className="relative top-px text-[0.8em] leading-none text-muted-foreground">
                            ≤
                          </span>{" "}
                          {tAlert("thresholdOption", {
                            minutes: item.alert.threshold,
                          })}
                        </ValueBadge>
                        <Switch
                          checked={item.alert.active}
                          disabled={busyId === item.id}
                          onCheckedChange={() => toggleActive(item.alert)}
                          aria-label={
                            item.alert.active ? t("deactivate") : t("activate")
                          }
                          size="lg"
                          checkedIcon={<BellRing />}
                          uncheckedIcon={<BellOff />}
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setEditing(item.alert)}
                          aria-label={t("edit")}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={busyId === item.id}
                          onClick={() => remove(item.alert)}
                          aria-label={t("delete")}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    }
                  />
                ) : (
                  <FeedRow
                    key={item.id}
                    kind="show"
                    icon={<Drama className="size-4" />}
                    title={item.reminder.showName}
                    subtitle={`${item.reminder.parkName} · ${formatTime(
                      item.reminder.startTime,
                    )}`}
                    trailing={
                      <>
                        <ValueBadge kind="show">
                          {t("leadBadge", { lead: item.reminder.leadMinutes })}
                        </ValueBadge>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setEditingReminder(item.reminder)}
                          aria-label={t("editLead")}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={busyId === item.id}
                          onClick={() => removeReminder(item.reminder)}
                          aria-label={t("delete")}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    }
                  />
                  ),
                )}
              </AnimatePresence>
            </ul>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <AlertHistoryFeed filter={filter} />
        </div>
      )}

      <EditThresholdDialog
        alert={editing}
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
        onSaved={applyThreshold}
      />

      <EditLeadDialog
        reminder={editingReminder}
        open={editingReminder !== null}
        onOpenChange={(v) => !v && setEditingReminder(null)}
        onSaved={applyLead}
      />
    </>
  );
}
