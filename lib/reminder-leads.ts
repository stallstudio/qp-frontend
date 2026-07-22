// Délais de prévenance des rappels de spectacle (minutes avant le début).
// Source unique partagée par la page spectacle, l'édition depuis le profil et la
// validation serveur.
export const REMINDER_LEAD_VALUES = [10, 20, 30, 40, 50, 60];

// Un rappel ne peut se déclencher que si `début - délai` est encore dans le
// FUTUR : inutile (et incohérent) de demander « 60 min avant » à 14h30 pour un
// spectacle à 15h00. On ne propose donc que les délais dont le déclenchement
// n'est pas déjà passé. Une petite marge évite de proposer un délai qui
// tomberait à la seconde près.
const LEAD_SAFETY_MARGIN_MS = 30_000;

export function availableLeadValues(
  startTime: Date | string,
  now: Date = new Date(),
): number[] {
  const start =
    typeof startTime === "string" ? new Date(startTime) : startTime;
  const startMs = start.getTime();
  if (Number.isNaN(startMs)) return [];
  return REMINDER_LEAD_VALUES.filter(
    (lead) => startMs - lead * 60_000 > now.getTime() + LEAD_SAFETY_MARGIN_MS,
  );
}

// Un délai est-il encore valable pour ce début de représentation ?
export function isLeadStillValid(
  leadMinutes: number,
  startTime: Date | string,
  now: Date = new Date(),
): boolean {
  const start =
    typeof startTime === "string" ? new Date(startTime) : startTime;
  const startMs = start.getTime();
  if (Number.isNaN(startMs)) return false;
  return startMs - leadMinutes * 60_000 > now.getTime();
}
