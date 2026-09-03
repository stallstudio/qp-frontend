/**
 * Vérification de la logique de cadence (`lib/collection-cycle.ts`).
 *
 *     node scripts/check-collection-cycle.ts
 *
 * Sans dépendance ni framework : le module est pur, et Node exécute le
 * TypeScript directement depuis la v22.6. C'est ce qui a motivé la découpe
 * `collection-cycle` / `collection-cycle-db`, sur le modèle de
 * `park-closing` / `park-closing-db`.
 *
 * ⚠️ Outil de POSTE, pas de CI : l'image de production tourne sur Node 20, qui
 * ne sait pas exécuter ce fichier. Il n'entre donc dans aucune étape de build,
 * et `tsconfig.json` exclut `scripts/**` pour cette raison.
 *
 * Les valeurs attendues viennent d'un relevé de 719 passages consécutifs
 * (12 h de production, 2026-09-03) : départ à la minute ronde + 0,8 s, fin à
 * +30 s en médiane, +45 s au p90, +55 s au p99, +63 s au maximum.
 */
import {
  delayFromEstimate,
  estimateCycle,
  snapshotTtlMs,
  type CollectionRun,
} from "../lib/collection-cycle.ts";

const MINUTE = 60_000;
/** Minute ronde de référence, et un instant 20 s après elle. */
const M12 = new Date("2026-09-03T12:00:00Z").getTime();
const NOW = M12 + 20_000;

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "OK  " : "FAIL"}  ${label}${ok ? "" : `\n        attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`}`,
  );
}
function checkRange(label: string, actual: number, min: number, max: number) {
  const ok = actual >= min && actual <= max;
  if (!ok) failures++;
  console.log(
    `${ok ? "OK  " : "FAIL"}  ${label} (${actual}${ok ? "" : `, attendu entre ${min} et ${max}`})`,
  );
}
/** Décalage, en secondes, d'un instant par rapport à sa minute ronde. */
const offsetInMinute = (t: number) => (((t % MINUTE) + MINUTE) % MINUTE) / 1000;

/**
 * Passages réguliers, du plus récent au plus ancien : un par minute, démarrant
 * sur la minute ronde et finissant `endAtS` secondes plus tard.
 */
function runs(count: number, endAtS: number, lastMinute = M12 - MINUTE): CollectionRun[] {
  return Array.from({ length: count }, (_, i) => {
    const started = lastMinute - i * MINUTE;
    return {
      startedAt: new Date(started + 800), // le worker démarre à +0,8 s
      completedAt: new Date(started + endAtS * 1000),
      durationMs: endAtS * 1000 - 800,
      status: "success",
    };
  });
}

console.log("\n— La phase se cale sur la fin des passages observés —");
{
  const e = estimateCycle(runs(60, 30), NOW);
  check("mesurée", e.measured, true);
  // p95 de fins toutes à +30 s, plus la marge de 2 s.
  check("phase = 32 s", e.phaseMs, 32_000);
  check("lecture calée sur la grille", offsetInMinute(e.nextReadAt), 32);
}

console.log("\n— Le cycle est ancré sur la donnée SERVIE, pas sur l'heure —");
{
  const e = estimateCycle(runs(60, 30), NOW);
  // Donnée écrite à 11:59:30 : la suivante arrive à 12:00:30, on lit à 12:00:32.
  const written = M12 - MINUTE + 30_000;
  check("on vise le créneau suivant la donnée", delayFromEstimate(e, NOW, written, 0), 12);

  // Même instant, mais le client tient déjà la donnée de 12:00 : il doit
  // attendre une minute de plus, pas revenir tout de suite.
  const fresher = M12 + 30_000;
  check("donnée déjà à jour → cycle complet", delayFromEstimate(e, NOW, fresher, 0), 72);
}

console.log("\n— Un horodatage FIGÉ ne peut pas arrêter le cycle —");
{
  const e = estimateCycle(runs(60, 30), NOW);
  // C'était le bug d'origine : `lastUpdate` gelé depuis une heure.
  const frozen = M12 - 60 * MINUTE + 30_000;
  const delay = delayFromEstimate(e, NOW, frozen, 0);
  check("on repart de la grille absolue", delay, 12);
  checkRange("et le délai reste sain", delay, 5, 125);
}

console.log("\n— Régression : pas de sondage rapproché en boucle —");
{
  // Le client vient de recevoir une donnée qu'il avait déjà (passage en retard).
  // L'ancienne version retombait sur son plancher de 20 s et re-sondait à vide
  // toutes les 25 s jusqu'à la fin du passage.
  const e = estimateCycle(runs(60, 30), NOW);
  const stale = M12 - 2 * MINUTE + 30_000;
  const delays = Array.from({ length: 5 }, () =>
    delayFromEstimate(e, NOW, stale, Math.random()),
  );
  check("aucun délai sous 10 s", delays.every((d) => d >= 10), true);
}

console.log("\n— Un passage qui déborde range sa donnée dans la minute suivante —");
{
  const e = estimateCycle(runs(60, 30), NOW);
  // Fin à 11:59:63, soit 12:00:03 : la collecte de 12:00 a été sautée (verrou),
  // la prochaine écriture est celle de 12:01.
  const overflowed = M12 + 3_000;
  check("on saute au créneau d'après", delayFromEstimate(e, NOW, overflowed, 0), 72);
}

console.log("\n— Sans ancrage (parc jamais collecté), la grille suffit —");
{
  const e = estimateCycle(runs(60, 30), NOW);
  check("délai depuis la grille", delayFromEstimate(e, NOW, null, 0), 12);
}

console.log("\n— Aucune donnée : repli, jamais d'arrêt —");
{
  const e = estimateCycle([], NOW);
  check("non mesurée", e.measured, false);
  check("phase de repli à 52 s", e.phaseMs, 52_000);
  checkRange("délai exploitable", delayFromEstimate(e, NOW, null, 0), 5, 125);
}

console.log("\n— Bornes de la phase —");
{
  check("plancher", estimateCycle(runs(60, 5), NOW).phaseMs, 20_000);
  check("plafond", estimateCycle(runs(60, 70), NOW).phaseMs, 55_000);
}

console.log("\n— Le jitter étale les retours sans les décaler d'un cycle —");
{
  const e = estimateCycle(runs(60, 30), NOW);
  const written = M12 - MINUTE + 30_000;
  const lo = delayFromEstimate(e, NOW, written, 0);
  const hi = delayFromEstimate(e, NOW, written, 1);
  check("le jitter ajoute au plus 5 s", hi - lo, 5);
}

console.log("\n— Le délai reste borné, quelles que soient les mesures —");
{
  const cases: [string, CollectionRun[], number | null][] = [
    ["passages interminables", runs(60, 300), M12 - MINUTE],
    ["passages instantanés", runs(60, 1), M12 - MINUTE],
    ["horodatage dans le futur", runs(60, 30), M12 + 10 * MINUTE],
    ["un seul passage connu", runs(1, 30), M12 - MINUTE],
  ];
  for (const [label, sample, anchor] of cases) {
    const d = delayFromEstimate(estimateCycle(sample, NOW), NOW, anchor, 1);
    checkRange(label, d, 5, 125);
  }
}

console.log("\n— Durée de vie du cache : ne jamais enjamber une écriture —");
{
  const MAX = 10_000;
  const e = estimateCycle(runs(60, 30), NOW);
  // Écriture attendue à 12:00:30, soit dans 10 s.
  check("cache limité à l'attente restante", snapshotTtlMs(e, NOW, MAX), 10_000);
  check(
    "plafond habituel une fois l'écriture passée",
    snapshotTtlMs(e, M12 + 35_000, MAX),
    MAX,
  );
  checkRange("jamais négatif", snapshotTtlMs(e, M12 + 29_999, MAX), 0, MAX);
}

console.log(`\n${failures === 0 ? "Tout passe." : `${failures} échec(s).`}`);
process.exit(failures === 0 ? 0 : 1);
