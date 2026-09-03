/**
 * Quand la prochaine écriture des temps d'attente est-elle attendue ?
 *
 * ————————————————————————————————————————————————————————————————————————
 * POURQUOI CE MODULE EXISTE
 * ————————————————————————————————————————————————————————————————————————
 * La page d'un parc affiche un décompte avant son prochain rafraîchissement.
 * Il a été calculé de deux façons, fausses toutes les deux, parce que toutes
 * deux DEVINAIENT côté client une cadence que seul le serveur connaît :
 *
 *   1. `lastUpdate + 60 s` — l'horodatage de la donnée. `parks.lastUpdatedAt`
 *      n'étant écrit QUE si le fetch réussit, il se figeait dès qu'une source
 *      tombait, le décompte plongeait dans le négatif et plus rien ne se
 *      rafraîchissait. Et comme cet horodatage est le MÊME pour tous les parcs
 *      (un `updateMany` unique en fin de passage), tous les onglets ouverts du
 *      site convergeaient vers la même seconde.
 *   2. `Date.now() + 60 s` — l'horloge du client. Increvable, mais désynchronisé
 *      de la base, et remis à zéro à chaque rechargement de page.
 *
 * Aucune des deux ne pouvait tomber juste, parce que **la base n'est pas écrite
 * toutes les minutes**. La Schedule Dokploy déclenche bien un passage par
 * minute, mais `withRunLock` fait sortir immédiatement tout passage qui en
 * trouve un autre en cours — et un passage dure couramment plus d'une minute,
 * avec une durée qui « varie d'un facteur cinq dans la journée » (cf.
 * `runFetchWaitTimesOnce.ts` du worker). La période réelle est donc variable et
 * inconnue du client.
 *
 * ————————————————————————————————————————————————————————————————————————
 * COMMENT ON LA CONNAÎT
 * ————————————————————————————————————————————————————————————————————————
 * On la MESURE, au lieu de la supposer : `job_executions` porte un
 * `startedAt` / `completedAt` par passage de `fetchParkWaitTimes`. La période
 * entre deux écritures est l'écart entre deux `completedAt` — c'est exactement
 * la grandeur qu'on cherche à prédire, et la mesurer directement dispense de
 * raisonner sur les minutes rondes, les passages sautés ou le verrou.
 *
 * ⚠️ **Un passage sauté ne laisse AUCUNE ligne** : `monitorJob` est appelé à
 * l'intérieur de `withRunLock`, donc un tick qui ne prend pas le verrou n'écrit
 * rien. Les écarts observés portent donc déjà l'effet du verrou, sans qu'on ait
 * à le modéliser.
 *
 * ⚠️ **Médiane et non moyenne** : la distribution a une longue queue (une API
 * amont qui traîne suffit à tripler un passage) et une moyenne serait tirée par
 * ces valeurs isolées, au point de décaler tous les décomptes du site.
 *
 * ————————————————————————————————————————————————————————————————————————
 * CE QU'ON GARDE DU CORRECTIF PRÉCÉDENT
 * ————————————————————————————————————————————————————————————————————————
 * Sa propriété essentielle — **le cycle ne peut jamais s'arrêter** — est
 * conservée, mais obtenue par des BORNES plutôt qu'en ignorant l'état réel du
 * worker : quoi qu'on lise en base, y compris rien du tout, il sort d'ici un
 * délai compris entre `MIN_SECONDS` et `MAX_SECONDS`. Une collecte à l'arrêt
 * n'immobilise plus la page, elle la fait seulement sonder plus calmement.
 */

/** Cadence de repli, quand la base ne dit rien d'exploitable. C'est l'ancien
 *  comportement en dur : le pire cas est donc l'état antérieur, jamais pire. */
export const FALLBACK_PERIOD_MS = 60_000;

/** Délai de sécurité après l'écriture attendue. Sonder PILE à l'échéance, sur
 *  une estimation à quelques secondes près, c'est rater d'un cheveu une fois
 *  sur deux et attendre un cycle entier pour rien. */
const SETTLE_SECONDS = 5;

/** Plancher : au-delà, on sonderait plus vite que la donnée ne bouge. Il ne
 *  sert qu'aux cas dégradés (écriture en retard), le cas normal étant toujours
 *  très au-dessus. */
const MIN_SECONDS = 20;

/** Plafond : une page laissée ouverte doit se remettre à jour dans un délai
 *  humainement acceptable, même si le worker met dix minutes à répondre. */
const MAX_SECONDS = 180;

/** Étalement anti-rafale. Sans lui, tous les visiteurs d'un même parc
 *  reviendraient à la seconde près en même temps — la convergence que
 *  l'ancrage sur `lastUpdate` produisait à l'échelle du site entier. */
const JITTER_SECONDS = 8;

/** Retard, en multiples de période, au-delà duquel on cesse de croire à une
 *  écriture imminente et on repasse au rythme de repli. */
const STALL_FACTOR = 3;

/** Âge au-delà duquel un passage encore marqué `running` est tenu pour mort.
 *  Un worker tué en plein passage laisse sa ligne ouverte pour toujours : sans
 *  ce garde-fou, on attendrait indéfiniment une fin qui ne viendra pas. */
const DEAD_RUN_MS = 10 * 60_000;

/** Un passage, réduit à ce qui sert ici. Volontairement sans type Prisma : la
 *  logique est pure et vérifiable sans base. */
export type CollectionRun = {
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  status: string;
};

export type CycleEstimate = {
  /** Instant estimé de la prochaine écriture, en ms epoch. */
  nextWriteAt: number;
  /** Période observée entre deux écritures, en ms. */
  periodMs: number;
  /** La collecte semble à l'arrêt : l'écriture attendue a trop de retard. */
  stalled: boolean;
  /** Faux quand l'estimation ne repose sur aucune mesure (table vide, panne) :
   *  sert au diagnostic, la valeur reste utilisable dans tous les cas. */
  measured: boolean;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

/**
 * Estime le cycle à partir des derniers passages.
 *
 * `runs` est attendu du PLUS RÉCENT au plus ancien (l'ordre que rend la
 * requête). Fonction pure : tout ce qui dépend de l'horloge passe par `now`.
 */
export function estimateCycle(
  runs: CollectionRun[],
  now: number,
): CycleEstimate {
  const completions = runs
    .map((run) => run.completedAt)
    .filter((date): date is Date => date != null)
    .map((date) => date.getTime())
    .sort((a, b) => b - a);

  // Écarts entre deux écritures consécutives. C'est la période réelle, verrou
  // et passages sautés compris.
  const gaps: number[] = [];
  for (let i = 0; i < completions.length - 1; i++) {
    gaps.push(completions[i] - completions[i + 1]);
  }

  const measuredPeriod = median(gaps);
  const periodMs = measuredPeriod ?? FALLBACK_PERIOD_MS;

  // Durée d'un passage, pour situer la fin de celui qui tourne encore.
  const durations = runs
    .map((run) => run.durationMs)
    .filter((value): value is number => value != null && value > 0);
  const typicalDurationMs = median(durations) ?? FALLBACK_PERIOD_MS;

  const lastCompletedAt = completions[0] ?? null;

  // Un passage EN COURS donne la meilleure estimation possible : sa fin est
  // l'écriture qu'on attend. Encore faut-il qu'il soit vivant — une ligne
  // `running` peut n'être que la trace d'un processus tué.
  const running = runs.find(
    (run) =>
      run.status === "running" &&
      run.completedAt == null &&
      now - run.startedAt.getTime() < DEAD_RUN_MS,
  );

  let nextWriteAt: number;
  if (running) {
    nextWriteAt = running.startedAt.getTime() + typicalDurationMs;
  } else if (lastCompletedAt != null) {
    nextWriteAt = lastCompletedAt + periodMs;
  } else {
    // Rien d'exploitable : on se comporte comme avant ce module.
    nextWriteAt = now + FALLBACK_PERIOD_MS;
  }

  const stalled = now - nextWriteAt > STALL_FACTOR * periodMs;

  return {
    nextWriteAt,
    periodMs,
    stalled,
    measured: measuredPeriod != null,
  };
}

/**
 * Secondes à attendre avant de redemander les données, jitter compris.
 *
 * Séparée d'`estimateCycle` parce qu'elle doit être évaluée à CHAQUE réponse
 * servie : l'estimation, elle, est mise en cache dix secondes et partagée. Sans
 * cette séparation, tous les visiteurs servis dans la même fenêtre de cache
 * recevraient le même délai — et se retrouveraient au même instant, ce que le
 * jitter est précisément là pour éviter.
 */
export function delayFromEstimate(
  estimate: CycleEstimate,
  now: number,
  jitter: number = Math.random(),
): number {
  const base = estimate.stalled
    ? FALLBACK_PERIOD_MS / 1000
    : (estimate.nextWriteAt - now) / 1000 + SETTLE_SECONDS;

  const spread = jitter * JITTER_SECONDS;
  const clamped = Math.min(Math.max(base, MIN_SECONDS), MAX_SECONDS);
  return Math.round(clamped + spread);
}

/**
 * Durée de vie à donner au cache d'un parc, compte tenu du cycle.
 *
 * ⚠️ **Un cache ne doit JAMAIS enjamber une écriture.** Rempli deux secondes
 * avant que le worker n'écrive, il resservirait la donnée précédente au premier
 * client arrivé après — précisément celui que `nextUpdateIn` a fait venir au bon
 * moment. Le décompte aurait l'air juste et la donnée serait vieille d'un cycle
 * entier : le pire des deux mondes.
 *
 * D'où la règle : avant l'écriture attendue, on ne met en cache que jusqu'à
 * elle ; après, la donnée fraîche est déjà là et le plafond habituel s'applique.
 */
export function snapshotTtlMs(
  estimate: CycleEstimate,
  now: number,
  maxTtlMs: number,
): number {
  const untilWrite = estimate.nextWriteAt - now;
  if (untilWrite <= 0) return maxTtlMs;
  return Math.min(maxTtlMs, untilWrite);
}
