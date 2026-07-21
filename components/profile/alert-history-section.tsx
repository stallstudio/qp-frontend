"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { DateTime } from "luxon";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import type { AlertHistoryDTO } from "@/types/user";

// Rafraîchissement de l'historique tant que la page est ouverte : une alerte
// peut arriver pendant qu'on regarde la page (le moteur tourne toutes les
// 1-2 min). On sonde régulièrement et les nouvelles lignes apparaissent en
// direct, avec la même animation « fluide » que le reclassement des attractions.
const POLL_INTERVAL_MS = 20000;

// Section « Historique des alertes » : lecture seule. Ce qui a été envoyé est
// conservé (attraction, seuil configuré, attente réelle, date/heure d'envoi).
// Rendu SANS carte (surface = carte à onglets du profil).
export default function AlertHistorySection() {
  const t = useTranslations("profile");
  const locale = useLocale();
  const { is12Hour } = useTimeFormat();
  const [history, setHistory] = useState<AlertHistoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  // Ids déjà présents au dernier rendu : sert à n'animer QUE les vraies
  // nouveautés (une ligne déjà affichée ne doit pas rejouer son entrée).
  const knownIdsRef = useRef<Set<string>>(new Set());
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get<AlertHistoryDTO[]>(
        "/api/user/alerts/history",
      );
      const incomingNew = data
        .filter((h) => !knownIdsRef.current.has(h.id))
        .map((h) => h.id);
      knownIdsRef.current = new Set(data.map((h) => h.id));
      setHistory(data);
      // Au tout premier chargement, on ne « fait pas entrer » l'historique
      // existant (freshIds vide) ; ensuite seules les nouvelles lignes animent.
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
    // Sondage périodique, en pause quand l'onglet est masqué (économie réseau).
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
    // `load` est stable hormis le flip initial de `loading` ; ce dernier ne doit
    // pas relancer d'intervalle. On ne (re)monte l'effet qu'une fois.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDate = (iso: string) =>
    DateTime.fromISO(iso)
      .setLocale(locale)
      .toLocaleString({
        ...DateTime.DATETIME_MED,
        hourCycle: is12Hour ? "h12" : "h23",
      });

  if (loading) {
    return (
      <div className="flex justify-center py-6 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <p className="py-2 text-sm text-muted-foreground">{t("historyEmpty")}</p>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {history.map((h) => (
          <motion.li
            key={h.id}
            layout="position"
            // Nouvelle ligne arrivée en direct : elle glisse depuis le haut ;
            // les anciennes sont montées sans animation (animate = état repos).
            initial={
              freshIds.has(h.id)
                ? { opacity: 0, height: 0, y: -8 }
                : false
            }
            animate={{ opacity: 1, height: "auto", y: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 36 }}
            className="overflow-hidden rounded-xl border px-3 py-2"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-medium">{h.rideName}</p>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {formatDate(h.sentAt)}
              </span>
            </div>
            {/* Compact : parc + détail de l'alerte sur une seule ligne. */}
            <p className="truncate text-xs text-muted-foreground">
              {h.parkName} ·{" "}
              {t("historyLine", {
                actual: h.actualWaitTime,
                threshold: h.threshold,
              })}
            </p>
          </motion.li>
        ))}
      </AnimatePresence>
      </ul>
      {/* Rappel de la rétention : au-delà de 30 jours, l'historique est masqué. */}
      <p className="mt-3 text-center text-xs text-muted-foreground">
        {t("historyRetentionNote")}
      </p>
    </>
  );
}
