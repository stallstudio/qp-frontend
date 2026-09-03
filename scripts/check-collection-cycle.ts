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
 * ne sait pas exécuter ce fichier. Il n'entre donc dans aucune étape de build.
 */
import {
  delayFromEstimate,
  estimateCycle,
  snapshotTtlMs,
  type CollectionRun,
} from "../lib/collection-cycle.ts";

const NOW = new Date("2026-09-03T12:00:00Z").getTime();
const s = (n: number) => n * 1000;

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"}  ${label}${ok ? "" : `\n        attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`}`);
}
function checkRange(label: string, actual: number, min: number, max: number) {
  const ok = actual >= min && actual <= max;
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"}  ${label} (${actual}${ok ? "" : `, attendu entre ${min} et ${max}`})`);
}

/** Suite de passages réguliers terminés, du plus récent au plus ancien. */
function runs(count: number, periodS: number, durationS: number, lastEndAgoS: number): CollectionRun[] {
  return Array.from({ length: count }, (_, i) => {
    const completed = NOW - s(lastEndAgoS) - s(i * periodS);
    return {
      startedAt: new Date(completed - s(durationS)),
      completedAt: new Date(completed),
      durationMs: s(durationS),
      status: "success",
    };
  });
}

console.log("\n— Cadence nominale : période 60 s, dernier passage terminé il y a 10 s —");
{
  const e = estimateCycle(runs(10, 60, 30, 10), NOW);
  check("période mesurée = 60 s", e.periodMs, s(60));
  check("mesurée", e.measured, true);
  check("pas en panne", e.stalled, false);
  check("prochaine écriture dans 50 s", (e.nextWriteAt - NOW) / 1000, 50);
  // 50 s restantes + 5 s de sécurité, + jitter 0..8
  checkRange("délai servi", delayFromEstimate(e, NOW, 0), 55, 55);
  checkRange("délai servi (jitter max)", delayFromEstimate(e, NOW, 1), 63, 63);
}

console.log("\n— Passages LENTS : la période réelle est de 120 s (une minute sur deux sautée) —");
{
  const e = estimateCycle(runs(10, 120, 90, 20), NOW);
  check("période mesurée = 120 s", e.periodMs, s(120));
  // C'est LE cas que l'ancien code ratait : il aurait décompté 60 s et sondé
  // dans le vide une fois sur deux.
  checkRange("délai servi ≈ 105 s", delayFromEstimate(e, NOW, 0), 105, 105);
}

console.log("\n— Passage EN COURS : l'écriture arrive à sa fin —");
{
  const base = runs(10, 60, 30, 40);
  const inProgress: CollectionRun = {
    startedAt: new Date(NOW - s(10)),
    completedAt: null,
    durationMs: null,
    status: "running",
  };
  const e = estimateCycle([inProgress, ...base], NOW);
  // démarré il y a 10 s, durée médiane 30 s → fin dans 20 s
  check("écriture dans 20 s", (e.nextWriteAt - NOW) / 1000, 20);
  checkRange("délai servi ≈ 25 s", delayFromEstimate(e, NOW, 0), 25, 25);
}

console.log("\n— Ligne `running` FOSSILE (worker tué il y a 2 h) : ignorée —");
{
  const fossil: CollectionRun = {
    startedAt: new Date(NOW - s(7200)),
    completedAt: null,
    durationMs: null,
    status: "running",
  };
  const e = estimateCycle([fossil, ...runs(10, 60, 30, 10)], NOW);
  check("on retombe sur le dernier passage terminé", (e.nextWriteAt - NOW) / 1000, 50);
}

console.log("\n— Collecte À L'ARRÊT : dernière écriture il y a une heure —");
{
  const e = estimateCycle(runs(10, 60, 30, 3600), NOW);
  check("détectée en panne", e.stalled, true);
  // On continue de sonder, mais au rythme de repli : ni martèlement, ni arrêt.
  checkRange("délai de repli", delayFromEstimate(e, NOW, 0), 60, 60);
}

console.log("\n— Écriture en RETARD léger (passage plus long que d'habitude) —");
{
  const e = estimateCycle(runs(10, 60, 30, 75), NOW);
  check("pas encore considérée en panne", e.stalled, false);
  // Échéance dépassée de 15 s → on ne martèle pas, on attend le plancher.
  checkRange("plancher respecté", delayFromEstimate(e, NOW, 0), 20, 20);
}

console.log("\n— Aucune donnée (table vide, base injoignable) —");
{
  const e = estimateCycle([], NOW);
  check("non mesurée", e.measured, false);
  check("pas en panne", e.stalled, false);
  checkRange("repli d'une minute", delayFromEstimate(e, NOW, 0), 65, 65);
}

console.log("\n— Un seul passage connu : pas d'écart mesurable —");
{
  const e = estimateCycle(runs(1, 60, 30, 10), NOW);
  check("non mesurée", e.measured, false);
  check("repli d'une minute", e.periodMs, s(60));
}

console.log("\n— Période ABERRANTE : la médiane résiste aux valeurs isolées —");
{
  const normal = runs(9, 60, 30, 10);
  // Un trou d'une heure au milieu (redéploiement), qui ferait exploser une moyenne.
  const withGap = [...normal.slice(0, 4), ...normal.slice(4).map((r) => ({
    ...r,
    startedAt: new Date(r.startedAt.getTime() - s(3600)),
    completedAt: new Date(r.completedAt!.getTime() - s(3600)),
  }))];
  const e = estimateCycle(withGap, NOW);
  check("période toujours de 60 s", e.periodMs, s(60));
}

console.log("\n— Bornes : le délai reste toujours dans la fenêtre —");
{
  const cases: [string, CollectionRun[]][] = [
    ["passage interminable", runs(10, 3600, 3000, 30)],
    ["passages très rapides", runs(10, 5, 2, 0)],
    ["horodatages futurs", runs(10, 60, 30, -600)],
  ];
  for (const [label, sample] of cases) {
    const e = estimateCycle(sample, NOW);
    const d = delayFromEstimate(e, NOW, 1);
    checkRange(label, d, 20, 188);
  }
}

console.log("\n— Durée de vie du cache : ne jamais enjamber une écriture —");
{
  const MAX = 10_000;
  const soon = estimateCycle(runs(10, 60, 30, 57), NOW); // écriture dans 3 s
  check("cache réduit à l'attente restante", snapshotTtlMs(soon, NOW, MAX), 3000);

  const far = estimateCycle(runs(10, 60, 30, 5), NOW); // écriture dans 55 s
  check("plafond habituel quand l'écriture est loin", snapshotTtlMs(far, NOW, MAX), MAX);

  const late = estimateCycle(runs(10, 60, 30, 90), NOW); // écriture en retard
  check("plafond habituel une fois l'écriture passée", snapshotTtlMs(late, NOW, MAX), MAX);
}

console.log(`\n${failures === 0 ? "Tout passe." : `${failures} échec(s).`}`);
process.exit(failures === 0 ? 0 : 1);
