import type { TimedPoint } from "@/lib/wait-times-forecast";

export type { TimedPoint };

// Réponse de GET /api/park/[parkId]/ride/[rideId]/history (enveloppée dans
// `{ data }` comme les autres routes park). Partagée par le front (graphique).
export interface RideHistoryResponse {
  timezone: string;
  // Fenêtre d'ouverture du jour (axe X du graphique). null si inconnue.
  window: { open: string; close: string } | null;
  now: string;
  // Courbe observée du jour (null = indisponible -> coupure).
  today: TimedPoint[];
  // Prévision de « maintenant » à la fermeture (vide si parc déjà fermé).
  forecast: TimedPoint[];
  meta: {
    scale: number;
    confidence: number;
    method: string;
    historyDays: number;
  };
}
