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

function isValueRange(v: unknown): v is ValueRange {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.value === "number" &&
    typeof o.min === "number" &&
    (o.max === null || typeof o.max === "number")
  );
}

/**
 * La table « valeur → fourchette » d'une attraction, pour dire une PRÉVISION en
 * fourchette : la prévision se cale sur les valeurs que l'attraction affiche,
 * chacune vient donc d'une fourchette.
 *
 * Celle que le worker a apprise sur l'historique (`baseProfile.valueRanges`),
 * complétée — et corrigée — par ce qui a été publié aujourd'hui : une
 * fourchette apparue ce matin n'est pas encore dans le profil.
 */
export function mergeValueRanges(
  stored: unknown,
  observed: Iterable<{ waitTime: number; waitRange?: WaitRange | null }>,
): ValueRange[] {
  const byValue = new Map<number, ValueRange>();
  if (Array.isArray(stored)) {
    for (const v of stored) if (isValueRange(v)) byValue.set(v.value, v);
  }
  for (const { waitTime, waitRange } of observed) {
    if (waitRange) byValue.set(waitTime, { value: waitTime, ...waitRange });
  }
  return [...byValue.values()].sort((a, b) => a.value - b.value);
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
