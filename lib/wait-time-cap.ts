/**
 * Valeurs de temps d'attente PLAFONNÉES à la source.
 *
 * ⚠️ **Certaines sources ne publient pas une durée au-delà d'un seuil, elles
 * publient « ce seuil ou plus ».** Le flux Mack (Europa-Park, Rulantica) s'arrête
 * à 91, qui signifie « 90 min ou plus » et non « 91 minutes » — au-delà, les
 * valeurs du flux sont des codes d'exploitation, pas des durées (voir
 * `waitTimesService.ts` côté worker). Ce n'est pas un cas marginal : sur les
 * grosses attractions d'Europa-Park, 91 représente de 25 % à 54 % des mesures
 * relevées (Wodan 54 %, Voltron Nevera 54 %, blue fire 49 %), quand la valeur
 * 90 elle-même n'apparaît que quelques dizaines de fois.
 *
 * Afficher « 91 min » promet donc une précision qui n'existe pas, et le promet
 * précisément là où l'attente est la plus longue. On affiche « 90+ ».
 *
 * ⚠️ **La règle est attachée au PROVIDER, pas à une liste de parcs.** C'est une
 * propriété du flux : tout parc servi par Mack en hérite, aujourd'hui comme
 * demain, sans qu'une liste soit à tenir à jour.
 */
export type WaitCap = {
  /** Valeur brute qui joue le rôle de sentinelle dans le flux. */
  value: number;
  /** Seuil réellement signifié, celui qu'on affiche suivi d'un « + ». */
  display: number;
};

/** Plafond du flux Mack : 91 signifie « 90 min ou plus ». */
export const MACK_WAIT_CAP: WaitCap = { value: 91, display: 90 };

const CAP_BY_PROVIDER: Record<string, WaitCap> = {
  mack: MACK_WAIT_CAP,
};

/** Plafond d'un parc, d'après le provider qui l'alimente. */
export function waitCapFor(provider: string | null | undefined): WaitCap | null {
  if (!provider) return null;
  return CAP_BY_PROVIDER[provider] ?? null;
}

/**
 * Une valeur est-elle la sentinelle de plafond ? `cap` absent (parc dont la
 * source ne plafonne pas) -> jamais.
 */
export function isCapped(
  waitTime: number | null | undefined,
  cap: WaitCap | null | undefined,
): boolean {
  return cap != null && waitTime === cap.value;
}

/**
 * Rend un temps d'attente en minutes, SANS unité : « 90+ » sur la sentinelle,
 * le nombre sinon. L'unité est ajoutée par l'appelant, les libellés étant
 * traduits.
 */
export function formatWaitMinutes(
  waitTime: number,
  cap: WaitCap | null | undefined,
): string {
  return isCapped(waitTime, cap) ? `${cap!.display}+` : String(waitTime);
}
