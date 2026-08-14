"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { DateTime } from "luxon";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { Bell, BellRing, Drama, RollerCoaster, Loader2 } from "lucide-react";
import { useTimeFormat } from "@/hooks/useTimeFormat";
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
//
// Cet onglet est en LECTURE SEULE : ni création, ni modification, ni suppression.
// Tout se règle depuis le popup de l'attraction ou du spectacle concerné, seul
// endroit où l'on voit le contexte (temps d'attente courant, horaires des
// représentations). Le profil ne fait que RÉCAPITULER ce qui est armé — un
// second jeu de contrôles ici n'aurait été qu'un doublon à maintenir.

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

// Marqueur de type de la ligne, teinté (orange attraction / violet spectacle).
// Sur MOBILE, la pastille 36 px mangeait une largeur qui manque au nom : on la
// remplace par un simple point de couleur, qui porte la même information de type.
function Avatar({
  kind,
  children,
}: {
  kind: "ride" | "show";
  children: React.ReactNode;
}) {
  return (
    <>
      <span
        aria-hidden
        className={`size-2.5 shrink-0 rounded-full sm:hidden ${
          kind === "show" ? "bg-show" : "bg-primary"
        }`}
      />
      <div
        className={`hidden size-9 shrink-0 items-center justify-center rounded-xl sm:flex ${
          kind === "show" ? "bg-show/10 text-show" : "bg-primary/10 text-primary"
        }`}
      >
        {children}
      </div>
    </>
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

export default function AlertsSection() {
  const t = useTranslations("profile");
  const tAlert = useTranslations("alerts");
  const locale = useLocale();
  const { is12Hour } = useTimeFormat();

  const [subTab, setSubTab] = useState<SubTab>("active");
  const [filter, setFilter] = useState<TypeFilter>("all");

  const [alerts, setAlerts] = useState<AlertDTO[]>([]);
  // Rappels de spectacle ACTIFS (programmés, pas encore envoyés).
  const [reminders, setReminders] = useState<ShowReminderDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get<AlertDTO[]>("/api/user/alerts"),
      axios.get<ShowReminderDTO[]>("/api/user/show-reminders"),
    ])
      .then(([alertsRes, remindersRes]) => {
        // Sous-onglet « Actives » : on n'affiche que ce qui est réellement armé.
        // Une alerte envoyée est supprimée par le moteur (elle rejoint
        // l'historique) ; il ne reste inactives que celles expirées avec la
        // journée, qui n'ont plus rien à faire dans cette liste.
        setAlerts(alertsRes.data.filter((a) => a.active));
        // Toutes les lignes en base sont des rappels EN ATTENTE (les envoyés
        // sont passés en historique) : plus de filtre `sent`.
        setReminders(remindersRes.data);
      })
      .catch(() => toast.error(t("loadError")))
      .finally(() => setLoading(false));
  }, [t]);

  // Heure d'une représentation, TOUJOURS dans le fuseau du parc : un spectacle
  // de 23:35 à Disneyland California doit se lire « 23:35 », pas l'heure qu'il
  // est alors chez le lecteur. Fuseau absent (parc introuvable) = repli sur le
  // navigateur, comme avant.
  const formatTime = (iso: string, timezone: string | null) =>
    DateTime.fromISO(iso, { zone: timezone ?? undefined })
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
    <div className="mb-2 flex items-center gap-2">
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

      {/* Règle du jeu (alertes et rappels ne valent que pour la journée en
          cours) : juste sous le titre, AVANT les sélecteurs — c'est le cadre de
          la section entière, pas une note de la seule liste des actives. */}
      <p className="mb-3 text-sm text-muted-foreground">
        {t("alertsDailyNote")}
      </p>

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
                      // Une alerte de réouverture n'a pas de seuil : la pastille
                      // annonce l'événement attendu au lieu d'une valeur.
                      item.alert.type === "reopen" ||
                      item.alert.threshold == null ? (
                        <ValueBadge kind="ride">
                          {t("reopenBadge")}
                        </ValueBadge>
                      ) : (
                        <ValueBadge kind="ride">
                          <span className="relative top-px text-[0.8em] leading-none text-muted-foreground">
                            ≤
                          </span>{" "}
                          {tAlert("thresholdOption", {
                            minutes: item.alert.threshold,
                          })}
                        </ValueBadge>
                      )
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
                      item.reminder.timezone,
                    )}`}
                    trailing={
                      <ValueBadge kind="show">
                        {t("leadBadge", { lead: item.reminder.leadMinutes })}
                      </ValueBadge>
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
    </>
  );
}
