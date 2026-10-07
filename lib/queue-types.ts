import { Clock, FastForward, User } from "lucide-react";

/** La file principale d'une attraction — celle que l'on appelle « l'attraction ». */
export const STANDBY_QUEUE = "standby";

/**
 * Files à attente CLASSIQUE : leur temps suit la journée et se répète d'un jour
 * à l'autre, d'où un graphique et une prévision. Miroir de
 * `FORECAST_QUEUE_TYPES` du worker (plus la file standby).
 *
 * ⚠️ Une file virtuelle, un créneau payant (Disney Premier Access) ou une
 * VirtualLine d'Europa-Park n'y figurent pas, à dessein : leur valeur dépend
 * de quotas et de ventes, et une courbe y promettrait ce qu'elle ne sait pas.
 */
export const CHARTED_QUEUE_TYPES: ReadonlySet<string> = new Set([
  STANDBY_QUEUE,
  "singlerider",
]);

type QueueTypeInfo = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

/** Libellés et icônes par défaut des files secondaires. */
export const QUEUE_TYPE_MAP: Record<string, QueueTypeInfo> = {
  fastlane: {
    label: "Fastlane",
    icon: FastForward,
  },
  singlerider: {
    label: "Single Rider",
    icon: User,
  },
  virtualqueue: {
    label: "Virtual Queue",
    icon: Clock,
  },
};

/**
 * Nom affiché d'une file : celui que le parc lui donne (`queueTypeLabels`,
 * « Disney Premier Access »), sinon le libellé par défaut, sinon le type brut.
 */
export function getQueueLabel(
  queueType: string,
  queueTypeLabels?: Record<string, string> | null,
): string {
  if (queueTypeLabels && queueTypeLabels[queueType]) {
    return queueTypeLabels[queueType];
  }
  if (QUEUE_TYPE_MAP[queueType]) {
    return QUEUE_TYPE_MAP[queueType].label;
  }
  return queueType.charAt(0).toUpperCase() + queueType.slice(1);
}
