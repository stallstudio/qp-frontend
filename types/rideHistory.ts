import type { TimedPoint } from "@/lib/wait-times-series";

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
  // Chaque point porte sa propre `margin` (± minutes) : l'erreur croît avec
  // l'horizon, une marge unique pour toute la courbe serait trompeuse.
  forecast: TimedPoint[];
  meta: {
    scale: number;
    confidence: number;
    // Niveau de fiabilité catégoriel affiché à l'utilisateur (badge).
    confidenceLevel: ConfidenceLevel;
    // true = prévision d'avant-ouverture (pur historique) -> note « sera mise à
    // jour à l'ouverture ».
    preOpening: boolean;
    method: string;
    historyDays: number;
    // true = attraction indisponible sur une longue période (ouverte < ~20 % du
    // temps) -> message dédié + alertes désactivées.
    chronicallyUnavailable: boolean;
    // Marge d'erreur MOYENNE de cette attraction (± minutes, toutes fenêtres
    // d'horizon confondues), et nombre de mesures qui la fondent. Sert la
    // mention textuelle sous le graphique ; le tracé de la bande utilise, lui,
    // la marge propre à chaque point. null = pas encore mesuré.
    marginMinutes: number | null;
    marginSamples: number;
  };
}

export type ConfidenceLevel = "low" | "medium" | "high";
