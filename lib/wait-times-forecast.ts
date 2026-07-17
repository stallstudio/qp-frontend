// Prévision des temps d'attente d'une attraction — module PUR (aucun accès
// Prisma / réseau). Toute la récupération de données vit dans
// `lib/wait-times-history.ts` ; ici on ne manipule que des structures déjà
// construites, ce qui rend l'algorithme isolé, remplaçable et testable.
//
// L'objectif n'est PAS une précision parfaite mais une estimation cohérente de
// la fin de journée, avec une architecture pensée pour être améliorée : on
// expose une interface `ForecastStrategy`, et l'implémentation v1
// (`ProfileTrendStrategyV1`) peut être remplacée sans toucher au reste.

// Un point horodaté d'une courbe. `waitTime = null` = attraction indisponible
// (fermée / en panne / valeur -1) à cet instant : le front trace une coupure.
export type TimedPoint = { t: string; waitTime: number | null };

// Intervalle temporel issu du modèle `wait_times` : la valeur `waitTime` reste
// constante de `start` à `end` (end = null => intervalle courant, actif jusqu'à
// « maintenant »).
export type WaitInterval = {
  start: Date;
  end: Date | null;
  waitTime: number;
  // status === "open" && waitTime >= 0. Sinon la valeur ne doit pas être tracée
  // ni entrer dans les calculs (moyennes, ratios).
  available: boolean;
};

// Les intervalles d'un jour donné, bornés par la fenêtre d'ouverture du parc.
export type DayIntervals = { open: Date; close: Date; intervals: WaitInterval[] };

export type ForecastInput = {
  timezone: string;
  now: Date;
  today: DayIntervals;
  // Jours précédents (déjà filtrés : uniquement des jours où le parc était
  // ouvert), utilisés pour construire une forme moyenne.
  history: DayIntervals[];
  // Granularité d'échantillonnage. Défaut 15 min.
  bucketMinutes?: number;
};

export type ForecastResult = {
  forecast: TimedPoint[];
  // Facteur « aujourd'hui plus/moins chargé que d'habitude » appliqué au profil.
  scale: number;
  // Indice de confiance 0..1, exposé au front (peut moduler l'affichage).
  confidence: number;
  // Identifiant de la stratégie ayant produit le résultat.
  method: string;
};

export interface ForecastStrategy {
  readonly id: string;
  forecast(input: ForecastInput): ForecastResult;
}

// ————————————————————————————————————————————————————————————————
// Helpers purs (exportés : réutilisables et testables indépendamment)
// ————————————————————————————————————————————————————————————————

const MS_PER_MIN = 60_000;

// Valeur de la step-function à l'instant `t` : temps de l'intervalle qui couvre
// `t`, ou `null` si indisponible / aucun intervalle. `end = null` couvre
// jusqu'à l'infini (intervalle courant).
export function sampleAt(intervals: WaitInterval[], t: Date): number | null {
  const ts = t.getTime();
  for (const iv of intervals) {
    const end = iv.end ? iv.end.getTime() : Infinity;
    if (iv.start.getTime() <= ts && ts < end) {
      return iv.available ? iv.waitTime : null;
    }
  }
  return null;
}

// Restreint des intervalles bruts à une fenêtre [open, close] (bornes incluses),
// en rognant ceux qui débordent. Un `end = null` est traité comme `close`.
export function sliceIntervalsForWindow(
  intervals: WaitInterval[],
  open: Date,
  close: Date,
): WaitInterval[] {
  const openMs = open.getTime();
  const closeMs = close.getTime();
  const result: WaitInterval[] = [];
  for (const iv of intervals) {
    const endMs = iv.end ? iv.end.getTime() : closeMs;
    if (iv.start.getTime() >= closeMs || endMs <= openMs) continue;
    result.push({
      ...iv,
      start: iv.start.getTime() < openMs ? open : iv.start,
      end: endMs > closeMs ? close : new Date(endMs),
    });
  }
  return result;
}

// Instants de DÉBUT de chaque bucket, de `open` à `close` (exclus). Arithmétique
// pure : l'alignement inter-jours se fait par « minutes écoulées depuis
// l'ouverture », ce qui évite tout piège de fuseau/minuit (voir stratégie).
export function bucketInstants(
  open: Date,
  close: Date,
  stepMinutes: number,
): Date[] {
  const stepMs = stepMinutes * MS_PER_MIN;
  const out: Date[] = [];
  for (let ms = open.getTime(); ms < close.getTime(); ms += stepMs) {
    out.push(new Date(ms));
  }
  return out;
}

// Reconstruit la série horodatée d'un jour pour l'affichage : un point à chaque
// changement d'état (début d'intervalle, calé sur l'ouverture), plus un point
// final à `upTo` reflétant la valeur courante. Les segments indisponibles
// produisent `null` (coupure de courbe).
export function reconstructTimedSeries(
  day: DayIntervals,
  upTo: Date,
): TimedPoint[] {
  const from = day.open;
  const to = new Date(Math.min(day.close.getTime(), upTo.getTime()));
  if (to.getTime() <= from.getTime()) return [];

  const points: TimedPoint[] = [];
  for (const iv of day.intervals) {
    const endMs = iv.end ? iv.end.getTime() : to.getTime();
    if (iv.start.getTime() >= to.getTime() || endMs <= from.getTime()) continue;
    const start = iv.start.getTime() < from.getTime() ? from : iv.start;
    points.push({
      t: start.toISOString(),
      waitTime: iv.available ? iv.waitTime : null,
    });
  }

  // Point final à `to` : prolonge la dernière valeur jusqu'à « maintenant ».
  const lastVal = sampleAt(day.intervals, new Date(to.getTime() - 1));
  const lastPoint = points[points.length - 1];
  if (!lastPoint || lastPoint.t !== to.toISOString()) {
    points.push({ t: to.toISOString(), waitTime: lastVal });
  }
  return points;
}

// Échantillonne un jour à intervalle régulier (au milieu de chaque bucket) de
// l'ouverture jusqu'à `upTo` (borné à la fermeture). Donne des points
// équidistants — alignés sur la même grille que la prévision — plutôt que sur
// les seuls changements d'état.
export function sampleDaySeries(
  day: DayIntervals,
  upTo: Date,
  stepMinutes: number,
): TimedPoint[] {
  const stepMs = stepMinutes * MS_PER_MIN;
  const limit = Math.min(day.close.getTime(), upTo.getTime());
  const points: TimedPoint[] = [];
  for (const bucket of bucketInstants(day.open, day.close, stepMinutes)) {
    const mid = new Date(bucket.getTime() + stepMs / 2);
    if (mid.getTime() > limit) break;
    points.push({
      t: mid.toISOString(),
      waitTime: sampleAt(day.intervals, mid),
    });
  }
  return points;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Comble les trous (`null`) d'un profil par interpolation linéaire entre les
// buckets connus les plus proches. Les trous en tête/queue prennent la valeur
// connue la plus proche (extrapolation plate).
function fillGaps(profile: (number | null)[]): void {
  const n = profile.length;
  let lastKnown = -1;
  for (let i = 0; i < n; i++) {
    if (profile[i] == null) continue;
    if (lastKnown === -1) {
      // Trou de tête : recopie la 1re valeur connue vers l'arrière.
      for (let j = 0; j < i; j++) profile[j] = profile[i];
    } else {
      const a = profile[lastKnown]!;
      const b = profile[i]!;
      const span = i - lastKnown;
      for (let j = lastKnown + 1; j < i; j++) {
        profile[j] = a + ((b - a) * (j - lastKnown)) / span;
      }
    }
    lastKnown = i;
  }
  // Trou de queue : recopie la dernière valeur connue vers l'avant.
  if (lastKnown !== -1) {
    for (let j = lastKnown + 1; j < n; j++) profile[j] = profile[lastKnown];
  }
}

// ————————————————————————————————————————————————————————————————
// Stratégie v1 : profil moyen historique × échelle du jour + raccord tendance
// ————————————————————————————————————————————————————————————————

// Fenêtre (min) sur laquelle la prévision privilégie la continuité avec le
// dernier point observé avant de rejoindre la forme historique.
const BLEND_MINUTES = 60;
// Recul (min) pour estimer la pente courte de la tendance actuelle.
const SLOPE_LOOKBACK_MINUTES = 30;
// Bornes du facteur d'échelle : évite les extrapolations absurdes le matin
// quand peu de buckets sont encore observés.
const SCALE_MIN = 0.3;
const SCALE_MAX = 3;

class ProfileTrendStrategyV1 implements ForecastStrategy {
  readonly id = "profile-trend-v1";

  forecast(input: ForecastInput): ForecastResult {
    const { now, today, history } = input;
    const step = input.bucketMinutes ?? 15;
    const { open, close } = today;

    // Parc déjà fermé pour la journée : aucune prévision.
    if (now.getTime() >= close.getTime()) {
      return { forecast: [], scale: 1, confidence: 0, method: this.id };
    }

    const buckets = bucketInstants(open, close, step);
    const stepMs = step * MS_PER_MIN;
    const midOf = (b: Date) => new Date(b.getTime() + stepMs / 2);

    // 1. Profil médian : pour chaque bucket i (= i·step après l'ouverture), on
    //    échantillonne les jours précédents au MÊME décalage depuis LEUR
    //    ouverture. Aligner par « minutes depuis l'ouverture » (et non par
    //    heure d'horloge) rend la comparaison robuste aux variations d'horaires
    //    et évite tout piège de fuseau/minuit.
    const profile: (number | null)[] = buckets.map((_, i) => {
      const offsetMs = i * stepMs + stepMs / 2;
      const samples: number[] = [];
      for (const day of history) {
        const inst = new Date(day.open.getTime() + offsetMs);
        if (inst.getTime() >= day.close.getTime()) continue;
        const v = sampleAt(day.intervals, inst);
        if (v != null) samples.push(v);
      }
      return samples.length ? median(samples) : null;
    });
    fillGaps(profile);

    // 2. Valeurs observées aujourd'hui, au milieu de chaque bucket déjà écoulé.
    const nowMs = now.getTime();
    const todayObs: (number | null)[] = buckets.map((b) => {
      const m = midOf(b);
      return m.getTime() <= nowMs ? sampleAt(today.intervals, m) : null;
    });

    // 3. Échelle du jour = médiane des ratios observé/profil sur les buckets
    //    écoulés (à quel point aujourd'hui est plus/moins chargé qu'à l'habitude).
    const ratios: number[] = [];
    for (let i = 0; i < buckets.length; i++) {
      const o = todayObs[i];
      const p = profile[i];
      if (o != null && p != null && p > 0) ratios.push(o / p);
    }
    const scale = ratios.length ? clamp(median(ratios), SCALE_MIN, SCALE_MAX) : 1;

    // 4. Dernier point observé + pente courte, pour un raccord propre.
    const observed = todayObs.filter((v): v is number => v != null);
    const lastObs = observed.length ? observed[observed.length - 1] : null;
    const slope = this.shortTermSlope(today.intervals, now);
    const carryLast = lastObs ?? 0;

    const forecast: TimedPoint[] = [];
    for (let i = 0; i < buckets.length; i++) {
      const m = midOf(buckets[i]);
      if (m.getTime() <= nowMs) continue;
      const horizon = (m.getTime() - nowMs) / MS_PER_MIN; // minutes à venir
      const base = profile[i] != null ? profile[i]! : carryLast;
      const model = base * scale;
      const trend = lastObs != null ? lastObs + slope * horizon : model;
      // Pondération : 1 au raccord (h→0) → suit la tendance/continuité ; 0
      // au-delà de BLEND_MINUTES → suit la forme historique mise à l'échelle.
      const w = clamp(1 - horizon / BLEND_MINUTES, 0, 1);
      const value = Math.max(0, Math.round(w * trend + (1 - w) * model));
      forecast.push({ t: m.toISOString(), waitTime: value });
    }

    // Confiance : croît avec le nombre de jours d'historique et la part de
    // buckets écoulés effectivement observés aujourd'hui.
    const elapsedBuckets = buckets.filter(
      (b) => midOf(b).getTime() <= nowMs,
    ).length;
    const overlap = elapsedBuckets ? observed.length / elapsedBuckets : 0;
    const confidence = clamp(
      0.2 + 0.08 * Math.min(history.length, 7) + 0.3 * overlap,
      0,
      1,
    );

    return { forecast, scale, confidence, method: this.id };
  }

  // Pente (min d'attente par minute) sur les dernières SLOPE_LOOKBACK_MINUTES.
  // 0 si l'une des deux extrémités est indisponible.
  private shortTermSlope(intervals: WaitInterval[], now: Date): number {
    const vNow = sampleAt(intervals, new Date(now.getTime() - 1));
    const vPrev = sampleAt(
      intervals,
      new Date(now.getTime() - SLOPE_LOOKBACK_MINUTES * MS_PER_MIN),
    );
    if (vNow == null || vPrev == null) return 0;
    return (vNow - vPrev) / SLOPE_LOOKBACK_MINUTES;
  }
}

// Stratégie active. Changer cette ligne (ou router selon un critère) suffit à
// faire évoluer l'algorithme sans toucher aux appelants.
export const activeForecastStrategy: ForecastStrategy = new ProfileTrendStrategyV1();
