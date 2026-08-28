import type { QueueTime, WaitTime } from "@/types/waitTime";

/**
 * Ordre de tri des états : ce qu'on peut faire tout de suite d'abord.
 *
 * Partagé par le tableau des attractions et celui des autres familles — deux
 * listes du même onglet ne peuvent pas classer « en panne » différemment.
 */
export const STATUS_ORDER = {
  open: 0,
  down: 1,
  closed: 2,
  maintenance: 3,
} as const;

// Au-delà de cette longueur, le dernier mot n'est plus collé aux icônes (voir
// `splitGluedTail`).
const MAX_GLUED_TAIL = 18;

/**
 * Découpe un libellé en « début » + « dernier mot ».
 *
 * Le dernier mot est ensuite rendu dans le même bloc `whitespace-nowrap` que les
 * icônes qui le suivent (chevron, cloche, type de file). Sans ça, sur mobile,
 * ces icônes se retrouvent SEULES sur une ligne, sans texte — un rendu qui
 * n'évoque rien. Quand la place manque, c'est donc le dernier mot qui part à la
 * ligne AVEC elles : « Voltron Nevera powered by » / « Rimac ⌄ 🔔 ».
 *
 * Garde-fou : un dernier mot très long resterait insécable et déborderait de la
 * colonne (étroite sur mobile). Au-delà de `MAX_GLUED_TAIL` caractères on
 * repasse donc au flux normal ; seules les icônes restent solidaires entre
 * elles.
 */
export function splitGluedTail(name: string): { head: string; tail: string } {
  const lastSpace = name.lastIndexOf(" ");
  const candidate = name.slice(lastSpace + 1);
  if (candidate.length > MAX_GLUED_TAIL) return { head: name, tail: "" };
  return { head: name.slice(0, lastSpace + 1), tail: candidate };
}

/**
 * La file qui représente le POI dans une liste : sa file standby, ou à défaut la
 * première qu'il publie.
 *
 * Un POI non-attraction n'en a jamais qu'une, mais elle porte quand même le type
 * `standby` : c'est ce que les fetchers écrivent, faute d'autre chose à dire.
 */
export function getPrimaryQueue(wt: WaitTime): QueueTime | undefined {
  return wt.queues.find((q) => q.type === "standby") || wt.queues[0];
}
