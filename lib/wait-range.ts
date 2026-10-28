import type { WaitRange } from "@/types/waitTime";

/**
 * Fourchettes d'attente (« 10-20 min »), publiées par certains parcs.
 *
 * ⚠️ **Elles ne servent qu'à l'AFFICHAGE.** Couleur, tri, alertes et prévisions
 * calculent sur `waitTime`, qui en est la borne haute pour tous les parcs (règle
 * du worker, `utils/waitRange.ts`). Afficher « 10–20 » en vert, c'est afficher
 * le vert de 20.
 */

/** Une valeur du vocabulaire d'une attraction, et la fourchette publiée derrière elle. */
export type ValueRange = WaitRange & { value: number };

/** La fourchette d'une ligne `wait_times`, `null` quand la source donne un nombre. */
export function readWaitRange(
  min: number | null | undefined,
  max: number | null | undefined,
): WaitRange | null {
  return min == null ? null : { min, max: max ?? null };
}

/** La fourchette derrière une valeur, `null` si on n'en connaît pas. */
export function rangeLookup(
  valueRanges: ValueRange[] | null | undefined,
): (value: number) => WaitRange | null {
  const byValue = new Map((valueRanges ?? []).map((r) => [r.value, r]));
  return (value) => {
    const r = byValue.get(value);
    return r ? { min: r.min, max: r.max } : null;
  };
}
