// Reconstruction de la courbe OBSERVÉE d'une attraction — module PUR (aucun
// accès Prisma / réseau). Il ne manipule que des structures déjà construites par
// `lib/wait-times-history.ts`, ce qui le rend isolé et testable.
//
// Historique : ce fichier portait aussi le moteur de PRÉVISION. Celui-ci vit
// désormais dans le worker (`tw-waittimes-worker`, table `ride_forecast`) et le
// frontend se contente de LIRE la prévision stockée — il ne reste donc ici que
// l'échantillonnage de l'observé.

// Un point horodaté d'une courbe. `waitTime = null` = attraction indisponible
// (fermée / en panne / valeur -1) à cet instant : le front trace une coupure.
// `status` (renseigné seulement quand indispo) porte la RAISON (closed / down /
// maintenance / open-mais--1) pour colorer la barre basse et le tooltip.
export type TimedPoint = {
  t: string;
  waitTime: number | null;
  status?: string | null;
  // Points de PRÉVISION uniquement : marge d'erreur (± minutes) attendue à cet
  // horizon, calculée par le worker à partir de la justesse réellement mesurée
  // les jours précédents (table `forecast_accuracy`). `null`/absent = pas assez
  // de mesures -> le graphique n'affiche pas de bande d'incertitude.
  margin?: number | null;
};

// Intervalle temporel issu du modèle `wait_times` : la valeur `waitTime` reste
// constante de `start` à `end` (end = null => intervalle courant, actif jusqu'à
// « maintenant »).
export type WaitInterval = {
  start: Date;
  end: Date | null;
  waitTime: number;
  // Statut brut (`open` | `closed` | `down` | `maintenance`) conservé pour
  // colorer l'indispo côté front.
  status: string;
  // status === "open" && waitTime >= 0. Sinon la valeur ne doit pas être tracée.
  available: boolean;
};

// Les intervalles d'un jour donné, bornés par la fenêtre d'ouverture du parc.
export type DayIntervals = {
  open: Date;
  close: Date;
  intervals: WaitInterval[];
};

const MS_PER_MIN = 60_000;

// Intervalle couvrant l'instant `t`, ou `null` si aucun. `end = null` couvre
// jusqu'à l'infini (intervalle courant).
//
// `inclusiveEnd` accepte AUSSI l'intervalle qui se termine pile en `t`. Réservé
// au point de FERMETURE : une attraction qui bascule « fermée » à l'heure pile
// laisserait sinon un dernier point vide, alors que la question posée est
// justement « quel temps affichait-elle en fermant ? ».
function sampleIntervalAt(
  intervals: WaitInterval[],
  t: Date,
  inclusiveEnd = false,
): WaitInterval | null {
  const ts = t.getTime();
  let endingHere: WaitInterval | null = null;
  for (const iv of intervals) {
    const end = iv.end ? iv.end.getTime() : Infinity;
    if (iv.start.getTime() <= ts && ts < end) return iv;
    if (inclusiveEnd && end === ts && iv.start.getTime() < ts) endingHere = iv;
  }
  return endingHere;
}

// Instants de DÉBUT de chaque bucket, de `open` à `close` (exclus).
function bucketInstants(open: Date, close: Date, stepMinutes: number): Date[] {
  const stepMs = stepMinutes * MS_PER_MIN;
  const out: Date[] = [];
  for (let ms = open.getTime(); ms < close.getTime(); ms += stepMs) {
    out.push(new Date(ms));
  }
  return out;
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

// Échantillonne un jour à intervalle régulier de l'ouverture jusqu'à `upTo`
// (borné à la fermeture). Les points sont posés sur les BORNES de bucket
// (= horaires « fixes » : ouverture, ouverture+step, …) et non au milieu, pour
// que les horodatages affichés tombent sur des heures rondes. Même grille que
// la prévision du worker, donc raccord propre à « maintenant ».
export function sampleDaySeries(
  day: DayIntervals,
  upTo: Date,
  stepMinutes: number,
): TimedPoint[] {
  const limit = Math.min(day.close.getTime(), upTo.getTime());
  const points: TimedPoint[] = [];

  const pushPoint = (instant: Date, inclusiveEnd = false) => {
    const iv = sampleIntervalAt(day.intervals, instant, inclusiveEnd);
    const available = iv?.available ?? false;
    points.push({
      t: instant.toISOString(),
      waitTime: available ? iv!.waitTime : null,
      // Statut porté uniquement quand indispo (sinon inutile) : sert à colorer
      // la barre basse et le tooltip (closed/maintenance = rouge, down = orange).
      status: available ? undefined : iv?.status,
    });
  };

  for (const bucket of bucketInstants(day.open, day.close, stepMinutes)) {
    if (bucket.getTime() > limit) break;
    pushPoint(bucket);
  }

  // Point de FERMETURE. `bucketInstants` s'arrête AVANT `close` : sans ça, la
  // courbe d'une journée terminée s'interrompait jusqu'à un pas complet avant la
  // fermeture (parc fermant à 19:30 -> dernier point à 19:15), alors que l'axe,
  // lui, va bien jusqu'à 19:30 — on ne savait donc pas le temps affiché en fin de
  // journée. Ajouté UNIQUEMENT quand la journée est finie : en cours de journée,
  // la courbe doit s'arrêter à « maintenant », c'est la prévision qui prend le
  // relais. Le dernier pas peut être plus court que les autres (fermeture pas
  // forcément alignée sur la grille) — c'est voulu.
  const lastMs = points.length
    ? Date.parse(points[points.length - 1].t)
    : null;
  if (limit === day.close.getTime() && lastMs !== null && lastMs < limit) {
    pushPoint(day.close, true);
  }

  return points;
}
