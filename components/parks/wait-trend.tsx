"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

type WaitTrendProps = {
  // Suite des temps standby du jour (peut contenir des -1 pour les périodes
  // indisponibles, qu'on ignore).
  history: number[];
  // Temps d'attente courant (source de vérité). -1 = indisponible.
  current: number;
  className?: string;
};

// Écart (en minutes) à partir duquel on considère que la tendance monte/descend.
const THRESHOLD = 5;
// Nombre de points récents (disponibles) pris en compte comme référence.
const WINDOW = 5;

/**
 * Tendance récente du temps d'attente, à afficher à côté du temps courant :
 * flèche montante (rouge), stable (neutre) ou descendante (verte).
 *
 * - Aucune flèche si le temps courant est indisponible.
 * - Aucune flèche tant qu'on n'a pas d'historique exploitable : au chargement
 *   de la page (données pas encore reçues) on laisse vide plutôt que d'afficher
 *   une flèche grise par défaut. La flèche n'apparaît qu'une fois les vraies
 *   données arrivées.
 * - Les périodes indisponibles passées (-1) sont ignorées : on compare donc
 *   la valeur courante à la dernière valeur connue *avant* l'indisponibilité.
 *
 * Les couleurs reprennent celles des pastilles d'état (vert / rouge).
 */
export default function WaitTrend({ history, current, className }: WaitTrendProps) {
  // Indisponible actuellement -> pas de flèche.
  if (typeof current !== "number" || current < 0) return null;

  const clean = history.filter((v) => typeof v === "number" && v >= 0);
  const recent = clean.slice(-WINDOW);
  // Pas encore d'historique réel (chargement en cours) -> pas de flèche.
  if (recent.length === 0) return null;

  const base = recent[0];
  const delta = current - base;

  if (delta >= THRESHOLD) {
    return (
      <ArrowUpRight
        className={`size-4 text-red-400 ${className ?? ""}`}
        aria-label="En hausse"
      />
    );
  }
  if (delta <= -THRESHOLD) {
    return (
      <ArrowDownRight
        className={`size-4 text-green-400 ${className ?? ""}`}
        aria-label="En baisse"
      />
    );
  }
  return (
    <ArrowRight
      className={`size-4 text-muted-foreground/40 ${className ?? ""}`}
      aria-label="Stable"
    />
  );
}
