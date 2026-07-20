// Seuils d'alerte sélectionnables. En dessous de 5 min on autorise UNIQUEMENT
// 1 et 0 (« prévenez-moi quand ça passe sous 1 min / dès que ça ouvre »), pas
// les valeurs intermédiaires (2, 3, 4). Au-dessus, pas de 5 min classique.
// Utilisé par le NumberStepper des alertes (popup attraction + profil).
export const ALERT_THRESHOLDS: number[] = [
  0,
  1,
  ...Array.from({ length: 24 }, (_, i) => (i + 1) * 5), // 5, 10, ..., 120
];

export const DEFAULT_ALERT_THRESHOLD = 20;
