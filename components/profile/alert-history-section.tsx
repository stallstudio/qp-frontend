"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { DateTime } from "luxon";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronDown,
  ChevronUp,
  Drama,
  Loader2,
  RollerCoaster,
} from "lucide-react";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import type { AlertHistoryDTO, ShowReminderHistoryDTO } from "@/types/user";

// Rafraîchissement tant que la page est ouverte : une notification peut arriver
// pendant qu'on regarde (le moteur tourne toutes les 1-2 min). Les nouvelles
// lignes apparaissent en direct, avec la même animation que le reste du profil.
const POLL_INTERVAL_MS = 20000;

// Entrées visibles au repos ; au-delà, on déroule le reste (voir plus / moins).
const PER_PAGE = 10;

const EASE = [0.32, 0.72, 0, 1] as const;

type TypeFilter = "all" | "rides" | "shows";

// Ligne d'historique normalisée (attraction OU spectacle), pour un fil unique
// trié par date d'envoi décroissante.
type HistoryItem = {
  id: string;
  kind: "ride" | "show";
  sentAt: string;
  title: string;
  subtitle: string;
};

// Pastille (icône) : carré à bords arrondis, teinté selon le type (orange
// attraction / violet spectacle) — cohérent avec le fil des alertes actives.
function HistoryAvatar({ kind }: { kind: "ride" | "show" }) {
  return (
    <div
      className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
        kind === "show" ? "bg-show/10 text-show" : "bg-primary/10 text-primary"
      }`}
    >
      {kind === "ride" ? (
        <RollerCoaster className="size-4" />
      ) : (
        <Drama className="size-4" />
      )}
    </div>
  );
}

// Fil d'historique unifié (lecture seule) : une seule liste sur toute la largeur,
// filtrée par type (Tout · Attractions · Spectacles) via la prop `filter`. Pas
// d'en-tête propre (le parent — AlertsSection — porte l'onglet et le filtre).
export default function AlertHistoryFeed({ filter }: { filter: TypeFilter }) {
  const t = useTranslations("profile");
  const tFav = useTranslations("favorites");
  const locale = useLocale();
  const { is12Hour } = useTimeFormat();
  const [rides, setRides] = useState<AlertHistoryDTO[]>([]);
  const [shows, setShows] = useState<ShowReminderHistoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  // Ids déjà présents au dernier rendu : n'animer QUE les vraies nouveautés.
  const knownIdsRef = useRef<Set<string>>(new Set());
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const [ridesRes, showsRes] = await Promise.all([
        axios.get<AlertHistoryDTO[]>("/api/user/alerts/history"),
        axios.get<ShowReminderHistoryDTO[]>("/api/user/show-reminders/history"),
      ]);
      const allIds = [
        ...ridesRes.data.map((h) => h.id),
        ...showsRes.data.map((h) => h.id),
      ];
      const incomingNew = allIds.filter((id) => !knownIdsRef.current.has(id));
      knownIdsRef.current = new Set(allIds);
      setRides(ridesRes.data);
      setShows(showsRes.data);
      if (incomingNew.length > 0 && !loading) {
        setFreshIds(new Set(incomingNew));
      }
    } catch {
      // silencieux : on garde l'historique déjà affiché.
    } finally {
      setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    load();
    const tick = () => {
      if (document.visibilityState === "visible") load();
    };
    const id = setInterval(tick, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDate = (iso: string) =>
    DateTime.fromISO(iso)
      .setLocale(locale)
      .toLocaleString({
        ...DateTime.DATETIME_MED,
        hourCycle: is12Hour ? "h12" : "h23",
      });

  const formatTime = (iso: string) =>
    DateTime.fromISO(iso)
      .setLocale(locale)
      .toLocaleString({
        ...DateTime.TIME_SIMPLE,
        hourCycle: is12Hour ? "h12" : "h23",
      });

  // Fusion des deux historiques en un fil unique, filtré, trié par date d'envoi.
  const items = useMemo<HistoryItem[]>(() => {
    const rideItems: HistoryItem[] =
      filter === "shows"
        ? []
        : rides.map((h) => ({
            id: h.id,
            kind: "ride",
            sentAt: h.sentAt,
            title: h.rideName,
            subtitle: `${h.parkName} · ${t("historyLine", {
              actual: h.actualWaitTime,
              threshold: h.threshold,
            })}`,
          }));
    const showItems: HistoryItem[] =
      filter === "rides"
        ? []
        : shows.map((h) => ({
            id: h.id,
            kind: "show",
            sentAt: h.sentAt,
            title: h.showName,
            subtitle: `${h.parkName} · ${t("historyShowLine", {
              time: formatTime(h.startTime),
              lead: h.leadMinutes,
            })}`,
          }));
    return [...rideItems, ...showItems].sort(
      (a, b) => DateTime.fromISO(b.sentAt).toMillis() - DateTime.fromISO(a.sentAt).toMillis(),
    );
    // formatTime dépend du locale/format ; recomposer si l'un change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rides, shows, filter, locale, is12Hour, t]);

  const emptyLabel =
    filter === "rides"
      ? t("historyEmptyRides")
      : filter === "shows"
        ? t("historyEmptyShows")
        : t("historyEmpty");

  if (loading) {
    return (
      <div className="flex justify-center py-6 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed py-6 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  const canCollapse = items.length > PER_PAGE;
  const base = canCollapse ? items.slice(0, PER_PAGE) : items;
  const extra = canCollapse ? items.slice(PER_PAGE) : [];

  const row = (item: HistoryItem, initial: false | object) => (
    <motion.li
      key={item.id}
      layout="position"
      initial={initial}
      animate={{ opacity: 1, height: "auto", y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 36 }}
      className="flex items-center gap-3 overflow-hidden rounded-xl border px-3 py-2"
    >
      <HistoryAvatar kind={item.kind} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {item.subtitle}
        </p>
      </div>
      <span className="shrink-0 whitespace-nowrap text-right text-[11px] text-muted-foreground">
        {formatDate(item.sentAt)}
      </span>
    </motion.li>
  );

  return (
    <>
      <ul className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {base.map((item) =>
            row(
              item,
              freshIds.has(item.id) ? { opacity: 0, height: 0, y: -8 } : false,
            ),
          )}
          {/* Extras : entrée/sortie en cascade (déroulé vers le bas). */}
          {showAll &&
            extra.map((item, i) => (
              <motion.li
                key={item.id}
                layout="position"
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{
                  opacity: 1,
                  height: "auto",
                  y: 0,
                  transition: {
                    duration: 0.26,
                    ease: EASE,
                    delay: Math.min(i, 8) * 0.03,
                  },
                }}
                exit={{
                  opacity: 0,
                  height: 0,
                  y: -10,
                  transition: {
                    duration: 0.22,
                    ease: EASE,
                    delay: Math.min(extra.length - 1 - i, 8) * 0.03,
                  },
                }}
                className="flex items-center gap-3 overflow-hidden rounded-xl border px-3 py-2"
              >
                <HistoryAvatar kind={item.kind} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.subtitle}
                  </p>
                </div>
                <span className="shrink-0 whitespace-nowrap text-right text-[11px] text-muted-foreground">
                  {formatDate(item.sentAt)}
                </span>
              </motion.li>
            ))}
        </AnimatePresence>
      </ul>

      {canCollapse && (
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {showAll ? (
              <>
                <ChevronUp className="size-4" />
                {tFav("seeLess")}
              </>
            ) : (
              <>
                <ChevronDown className="size-4" />
                {tFav("seeMore", { count: extra.length })}
              </>
            )}
          </button>
        </div>
      )}

      {/* Rappel de la rétention : au-delà de 30 jours, l'historique est masqué. */}
      <p className="mt-4 text-center text-xs text-muted-foreground">
        {t("historyRetentionNote")}
      </p>
    </>
  );
}
