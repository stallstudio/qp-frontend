"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { DateTime } from "luxon";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { POI_KIND_ICONS, type PoiKind } from "@/lib/poi-kinds";
import type { AlertDTO, ShowReminderDTO } from "@/types/user";
import AlertHistoryFeed from "./alert-history-section";
import FeedAvatar from "./feed-avatar";

// Onglet « Alertes » du profil — DIRECTION « fil unifié » :
//   • un seul fil sur toute la largeur (plus de colonnes qui ne s'alignent pas) ;
//   • deux sous-onglets Actives / Historique (segment compact, aligné à gauche
//     comme le tri de l'accueil) ;
//   • filtres Tout · Attractions · Spectacles — le type est un attribut de ligne
//     (pastille + accent : orange pour les attractions, violet pour les
//     spectacles), et les deux types sont mélangés puis triés par ordre
//     alphabétique. Une pastille « Restaurants » s'y ajoute dès qu'une alerte
//     de restaurant existe, active ou passée (2026-10-09) : les autres n'en
//     auront jamais.
//
// Cet onglet est en LECTURE SEULE : ni création, ni modification, ni suppression.
// Tout se règle depuis le popup de l'attraction ou du spectacle concerné, seul
// endroit où l'on voit le contexte (temps d'attente courant, horaires des
// représentations). Le profil ne fait que RÉCAPITULER ce qui est armé — un
// second jeu de contrôles ici n'aurait été qu'un doublon à maintenir.

// Une famille de POI : `show` filtre les rappels de spectacles, toutes les
// autres les alertes posées sur un POI de cette famille.
export type TypeFilter = "all" | PoiKind;
type SubTab = "active" | "history";

// Élément actif normalisé (alerte OU rappel de spectacle), pour un fil mélangé
// trié par titre.
type ActiveItem =
  | { kind: "alert"; id: string; sortKey: string; alert: AlertDTO }
  | { kind: "show"; id: string; sortKey: string; reminder: ShowReminderDTO };

// Les familles qui ont leur pastille de filtre, dans l'ordre : les attractions
// et les spectacles toujours, les autres quand elles ont une alerte.
const ALWAYS_FILTERED: readonly PoiKind[] = ["ride", "show"];

/** Les pastilles de filtre, d'après les familles présentes dans les alertes. */
export function filterKinds(present: ReadonlySet<PoiKind>): PoiKind[] {
  const extra = [...present].filter((kind) => !ALWAYS_FILTERED.includes(kind));
  return ["ride", ...extra, "show"];
}

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
//
// Couleurs en classes ENTIÈRES, comme `FeedAvatar`.
const CHIP_STYLES: Record<TypeFilter, { active: string; icon?: string }> = {
  all: { active: "border-foreground bg-foreground text-background" },
  ride: {
    active: "border-primary bg-primary text-primary-foreground",
    icon: "text-primary",
  },
  show: {
    active: "border-show bg-show text-show-foreground",
    icon: "text-show",
  },
  restaurant: {
    active: "border-restaurant bg-restaurant text-restaurant-foreground",
    icon: "text-restaurant",
  },
  shop: {
    active: "border-shop bg-shop text-shop-foreground",
    icon: "text-shop",
  },
  hotel: {
    active: "border-hotel bg-hotel text-hotel-foreground",
    icon: "text-hotel",
  },
  service: {
    active: "border-service bg-service text-service-foreground",
    icon: "text-service",
  },
};

function TypeChips({
  value,
  onChange,
  kinds,
  labels,
}: {
  value: TypeFilter;
  onChange: (v: TypeFilter) => void;
  kinds: readonly PoiKind[];
  labels: Record<TypeFilter, string>;
}) {
  const items: TypeFilter[] = ["all", ...kinds];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((key) => {
        const active = value === key;
        const Icon = key === "all" ? null : POI_KIND_ICONS[key];
        const iconColor = CHIP_STYLES[key].icon;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? CHIP_STYLES[key].active
                : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {/* Icône du type : teintée (orange / violet) au repos, elle suit la
                couleur du texte quand la puce est active. */}
            {Icon && (
              <span className={active ? "" : iconColor}>
                <Icon className="size-3.5" />
              </span>
            )}
            {labels[key]}
          </button>
        );
      })}
    </div>
  );
}

// Badge de valeur (seuil ≤ X / délai X min), en pilule monospace.
function ValueBadge({
  kind,
  children,
}: {
  kind: PoiKind;
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
  title,
  subtitle,
  trailing,
}: {
  kind: PoiKind;
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
      <FeedAvatar kind={kind} />
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
  // Les noms des familles, ceux des pastilles de la page d'un parc.
  const tCards = useTranslations("parkPage.cards");
  const locale = useLocale();
  const { is12Hour } = useTimeFormat();

  const [subTab, setSubTab] = useState<SubTab>("active");
  const [filter, setFilter] = useState<TypeFilter>("all");

  const [alerts, setAlerts] = useState<AlertDTO[]>([]);
  // Rappels de spectacle ACTIFS (programmés, pas encore envoyés).
  const [reminders, setReminders] = useState<ShowReminderDTO[]>([]);
  const [loading, setLoading] = useState(true);
  // Familles des alertes passées, remontées par le fil d'historique : une
  // pastille de filtre ne doit pas disparaître quand on change de sous-onglet.
  const [historyKinds, setHistoryKinds] = useState<ReadonlySet<PoiKind>>(
    new Set(),
  );

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
  // Heure limite d'une alerte de créneau : « HH:mm » en heure du PARC, telle
  // que la source la publie — affichée telle quelle, au format choisi.
  const formatSlot = (hhmm: string) =>
    DateTime.fromFormat(hhmm, "HH:mm")
      .setLocale(locale)
      .toLocaleString({
        ...DateTime.TIME_SIMPLE,
        hourCycle: is12Hour ? "h12" : "h23",
      });

  const formatTime = (iso: string, timezone: string | null) =>
    DateTime.fromISO(iso, { zone: timezone ?? undefined })
      .setLocale(locale)
      .toLocaleString({
        ...DateTime.TIME_SIMPLE,
        hourCycle: is12Hour ? "h12" : "h23",
      });

  // Fusion alertes + rappels de spectacles → un seul fil, filtré par type puis
  // trié par ordre alphabétique du nom.
  const activeItems = useMemo<ActiveItem[]>(() => {
    const alertItems: ActiveItem[] = alerts
      .filter((a) => filter === "all" || a.poiKind === filter)
      .map((a) => ({
        kind: "alert",
        id: a.id,
        sortKey: a.rideName,
        alert: a,
      }));
    const showItems: ActiveItem[] =
      filter !== "all" && filter !== "show"
        ? []
        : reminders.map((r) => ({
            kind: "show",
            id: r.id,
            sortKey: r.showName,
            reminder: r,
          }));
    return [...alertItems, ...showItems].sort((a, b) =>
      a.sortKey.localeCompare(b.sortKey, locale),
    );
  }, [alerts, reminders, filter, locale]);

  const activeEmptyLabel =
    filter === "all"
      ? t("activeEmptyAll")
      : filter === "show"
        ? t("alertsEmptyShows")
        : filter === "ride"
          ? t("alertsEmptyRides")
          : t("alertsEmptyOther");

  const chipKinds = filterKinds(
    new Set([...alerts.map((a) => a.poiKind), ...historyKinds]),
  );

  const filterLabels: Record<TypeFilter, string> = {
    all: t("filterAll"),
    ride: t("historyAttractions"),
    show: t("historyShows"),
    restaurant: tCards("restaurants"),
    shop: tCards("shops"),
    hotel: tCards("hotels"),
    service: tCards("services"),
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
        <TypeChips
          value={filter}
          onChange={setFilter}
          kinds={chipKinds}
          labels={filterLabels}
        />
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
                  item.kind === "alert" ? (
                  <FeedRow
                    key={item.id}
                    kind={item.alert.poiKind}
                    // Alerte d'une FILE : son nom suit celui de l'attraction.
                    title={
                      item.alert.queueLabel
                        ? `${item.alert.rideName} · ${item.alert.queueLabel}`
                        : item.alert.rideName
                    }
                    subtitle={item.alert.parkName}
                    trailing={
                      // Une alerte de réouverture n'a pas de seuil : la pastille
                      // annonce l'événement attendu au lieu d'une valeur.
                      item.alert.type === "slot" && item.alert.slotBefore ? (
                        <ValueBadge kind={item.alert.poiKind}>
                          {t("slotBadge", {
                            time: formatSlot(item.alert.slotBefore),
                          })}
                        </ValueBadge>
                      ) : item.alert.type === "reopen" ||
                        item.alert.threshold == null ? (
                        <ValueBadge kind={item.alert.poiKind}>
                          {t("reopenBadge")}
                        </ValueBadge>
                      ) : (
                        <ValueBadge kind={item.alert.poiKind}>
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
          <AlertHistoryFeed filter={filter} onKinds={setHistoryKinds} />
        </div>
      )}
    </>
  );
}
