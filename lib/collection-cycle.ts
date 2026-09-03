/**
 * Quand le client doit-il redemander les temps d'attente ?
 *
 * ————————————————————————————————————————————————————————————————————————
 * CE QUE FAIT LE WORKER, MESURÉ ET NON SUPPOSÉ
 * ————————————————————————————————————————————————————————————————————————
 * Relevé sur 719 passages consécutifs (12 h de production, 2026-09-03) :
 *
 *   - une Schedule Dokploy le démarre à CHAQUE minute ronde, à 0,8 s près, et
 *     719 des 720 minutes ont bien eu leur passage ;
 *   - un passage dure 29 s en médiane (p90 45 s, p99 55 s, max 63 s) ;
 *   - il termine donc dans SA minute dans 717 cas sur 718.
 *
 * ⚠️ **Les commentaires du worker affirment le contraire** — « un passage dure
 * couramment plus d'une minute », « varie d'un facteur cinq dans la journée » —
 * et c'est sur cette croyance qu'une première version de ce module a été écrite,
 * puis a mal fonctionné. Ces phrases décrivent un état ancien (elles datent des
 * incidents du 2026-08-11, avant le verrou et la réduction du pool). Refaire la
 * mesure avant de les croire.
 *
 * ————————————————————————————————————————————————————————————————————————
 * CE QU'ON EN FAIT
 * ————————————————————————————————————————————————————————————————————————
 * La donnée arrive donc à un instant très prévisible : **minute ronde + ~30 s**,
 * avec une dispersion de ±15 s. Il suffit au client de venir un peu après, à
 * PHASE fixe dans la minute, et de revenir toutes les minutes. Rien à deviner.
 *
 * ⚠️ **On vise un quantile HAUT, pas la médiane.** Viser la médiane, c'est
 * arriver trop tôt une fois sur deux, par construction. Les deux erreurs ne
 * coûtent pas la même chose : arriver dix secondes trop tard, c'est dix secondes
 * de fraîcheur ; arriver trop tôt, c'est une requête pour rien ET un décompte
 * qui saute, parce que l'échéance manquée est aussitôt recalculée au plus court.
 *
 * ⚠️ **Ce module ne prédit plus la fin du passage en cours.** La version
 * précédente le faisait, à partir de l'écart médian entre deux fins, et se
 * trompait dans les grandes largeurs : chaque estimation ratée renvoyait une
 * échéance déjà dépassée, donc un plancher de 20 s, donc un sondage à vide
 * toutes les 25 s jusqu'à la fin du passage. La grille des minutes rondes est
 * une information DURE ; l'écart médian n'était qu'une statistique bruitée.
 */

/** Repli quand aucune mesure n'est disponible : le worker a été observé
 *  terminant à p99 = 55 s, on s'y tient sans donnée pour dire mieux. */
const DEFAULT_PHASE_MS = 52_000;

/** Repli pour la première écriture plausible dans la minute (p05 mesuré à
 *  ~17 s, on prend un peu en dessous). */
const DEFAULT_EARLIEST_MS = 15_000;

/** Quantile visé pour la phase de lecture : on lit la donnée de la minute
 *  courante dans 95 % des cas ; sinon on lit celle d'avant et on la rattrape au
 *  tour suivant, ce qui ne se voit pas.
 *
 *  ⚠️ **Ne pas monter plus haut sans agrandir l'échantillon.** Sur soixante
 *  passages, 0,95 tombe sur le quatrième plus grand ; 0,99 tomberait sur le
 *  MAXIMUM, l'estimateur le plus bruité qui soit — la phase sauterait à chaque
 *  minute et ferait revenir le client dix secondes après son dernier appel. */
const PHASE_QUANTILE = 0.95;

/** Marge ajoutée au quantile : l'écriture de `lastUpdatedAt` précède la fin du
 *  passage de peu, et le réseau du visiteur ajoute son propre délai. */
const PHASE_MARGIN_MS = 2_000;

/** Bornes de la phase. Le plafond garde une marge avant la minute suivante :
 *  au-delà, le jitter ferait déborder les lectures sur le passage d'après. */
const MIN_PHASE_MS = 20_000;
const MAX_PHASE_MS = 55_000;

/** Étalement des retours. Petit, et par construction sans risque : la fenêtre
 *  sûre va de la fin d'un passage au début de l'écriture suivante (~13 s après
 *  la minute), soit une vingtaine de secondes. */
const JITTER_SECONDS = 5;

/** Garde-fous du délai rendu. Le modèle produit toujours une valeur dans la
 *  minute ; ils n'existent que contre une mesure aberrante. */
const MIN_DELAY_SECONDS = 5;
const MAX_DELAY_SECONDS = 120;

const MINUTE_MS = 60_000;

/** Un passage, réduit à ce qui sert ici. Volontairement sans type Prisma : la
 *  logique est pure et vérifiable sans base. */
export type CollectionRun = {
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  status: string;
};

export type CycleEstimate = {
  /** Instant, dans la minute, où l'on peut lire sans risque (ms depuis la
   *  minute ronde). */
  phaseMs: number;
  /** Prochain instant où il vaut la peine de relire. */
  nextReadAt: number;
  /** Première écriture possible à venir. Ne sert PAS au client : il borne la
   *  durée de vie du cache, qui ne doit jamais enjamber une écriture. */
  nextWriteAt: number;
  /** Faux quand rien n'a pu être mesuré (table vide, base injoignable) : sert
   *  au diagnostic, la valeur reste utilisable dans tous les cas. */
  measured: boolean;
};

function quantile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[index];
}

/** Prochain instant `k × 60 s + offset` strictement après `now`. */
function nextSlotAfter(now: number, offsetMs: number): number {
  const slot = Math.floor((now - offsetMs) / MINUTE_MS) + 1;
  return slot * MINUTE_MS + offsetMs;
}

/**
 * Estime le cycle à partir des derniers passages.
 *
 * `runs` est attendu du plus récent au plus ancien (l'ordre que rend la
 * requête). Fonction pure : tout ce qui dépend de l'horloge passe par `now`.
 */
export function estimateCycle(
  runs: CollectionRun[],
  now: number,
): CycleEstimate {
  // Position de la FIN de chaque passage dans sa minute. C'est la grandeur
  // qu'on cherche : « à quelle seconde la donnée est-elle prête ? »
  const endOffsets = runs
    .filter((run) => run.completedAt != null)
    .map((run) => {
      const started = run.startedAt.getTime();
      const minute = Math.round(started / MINUTE_MS) * MINUTE_MS;
      return run.completedAt!.getTime() - minute;
    })
    .filter((offset) => offset > 0 && offset < 2 * MINUTE_MS);

  const measuredPhase = quantile(endOffsets, PHASE_QUANTILE);
  const phaseMs =
    measuredPhase == null
      ? DEFAULT_PHASE_MS
      : Math.min(
          Math.max(measuredPhase + PHASE_MARGIN_MS, MIN_PHASE_MS),
          MAX_PHASE_MS,
        );

  // Borne basse de la même distribution : au plus tôt, la donnée de la minute
  // en cours peut apparaître là.
  const earliestMs = quantile(endOffsets, 0.05) ?? DEFAULT_EARLIEST_MS;

  return {
    phaseMs,
    nextReadAt: nextSlotAfter(now, phaseMs),
    nextWriteAt: nextSlotAfter(now, Math.min(earliestMs, phaseMs)),
    measured: measuredPhase != null,
  };
}

/**
 * Secondes à attendre avant de redemander les données, jitter compris.
 *
 * Séparée d'`estimateCycle` parce qu'elle doit être évaluée à CHAQUE réponse
 * servie : l'estimation, elle, est mise en cache et partagée. Sans cette
 * séparation, tous les visiteurs servis dans la même fenêtre de cache
 * recevraient le même délai — et reviendraient donc ensemble.
 */
export function delayFromEstimate(
  estimate: CycleEstimate,
  now: number,
  /**
   * Horodatage de la donnée qu'on vient de servir (`parks.lastUpdatedAt`).
   *
   * ⚠️ **C'est l'ancrage du cycle, et c'est ce qui manquait.** Calculer
   * l'échéance depuis `now` ignore ce que le serveur sait pourtant : quelle
   * minute de collecte le client tient déjà en main. La donnée ne changeant
   * qu'une fois par minute, celle d'après arrivera une minute après CELLE-CI —
   * pas une minute après l'instant où la requête a été servie.
   *
   * ⚠️ **Ce n'est pas le retour du bug d'origine.** L'ancienne version faisait
   * de cet horodatage la SEULE référence, si bien qu'il gelait tout en se
   * figeant. Ici il ne fait que placer le cycle sur la grille des minutes ; dès
   * qu'il a pris du retard, on repart de la grille absolue et le cycle continue.
   */
  lastUpdateMs: number | null,
  jitter: number = Math.random(),
): number {
  // Le créneau visé est celui qui suit la donnée en main. À défaut d'ancrage
  // (parc jamais collecté), la grille absolue fait aussi bien.
  const anchored =
    lastUpdateMs == null
      ? null
      : // `floor` et non `round` : la minute de collecte est celle qui PRÉCÈDE
        // l'écriture. Un arrondi basculerait au-delà de 30 s — exactement la
        // médiane des écritures observées, donc une fois sur deux.
        Math.floor(lastUpdateMs / MINUTE_MS) * MINUTE_MS +
        MINUTE_MS +
        estimate.phaseMs;

  // `anchored` déjà passé = l'écriture attendue a du retard, ou l'horodatage
  // est figé depuis longtemps. Dans les deux cas la grille reprend la main :
  // c'est ce qui rend l'arrêt du cycle impossible.
  const target =
    anchored != null && anchored > now ? anchored : estimate.nextReadAt;

  const base = (target - now) / 1000;
  const spread = jitter * JITTER_SECONDS;
  const clamped = Math.min(
    Math.max(base, MIN_DELAY_SECONDS),
    MAX_DELAY_SECONDS,
  );
  return Math.round(clamped + spread);
}

/**
 * Durée de vie à donner au cache d'un parc, compte tenu du cycle.
 *
 * ⚠️ **Un cache ne doit JAMAIS enjamber une écriture.** Rempli deux secondes
 * avant que le worker n'écrive, il resservirait la donnée précédente au premier
 * client arrivé après — précisément celui que le décompte a fait venir au bon
 * moment. Le décompte aurait l'air juste et la donnée serait vieille d'une
 * minute : le pire des deux mondes.
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
