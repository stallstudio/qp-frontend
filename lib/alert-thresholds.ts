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

// Seuil par défaut proposé pour une NOUVELLE alerte : le « cran juste en dessous »
// du temps d'attente actuel de l'attraction, dans la séquence ci-dessus
// (ex. 35 → 30, 12 → 10, 5 → 1, 1 → 0). Gère naturellement le 1/0 (on ne propose
// 1 que si l'attraction est au moins à 5, et 0 que si elle est à 1). Sans temps
// courant exploitable (fermée, indispo, pas de donnée), on retombe sur le défaut.
export function defaultThresholdForWait(currentWait?: number | null): number {
  if (currentWait == null || !Number.isFinite(currentWait) || currentWait <= 0) {
    return DEFAULT_ALERT_THRESHOLD;
  }
  let best = ALERT_THRESHOLDS[0];
  for (const v of ALERT_THRESHOLDS) {
    if (v < currentWait) best = v;
    else break; // séquence triée croissante : inutile d'aller plus loin
  }
  return best;
}
