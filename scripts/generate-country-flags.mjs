/**
 * Génère `lib/country-flags.generated.ts` : code ISO 3166-1 alpha-2 → classe
 * `twa-flag-…`.
 *
 * ⚠️ **La table n'est pas SAISIE, elle est LUE dans la feuille de style.**
 * Chaque règle de `app/twemoji-amazing.css` pointe le SVG twemoji du drapeau,
 * dont le nom de fichier est la paire d'indicateurs régionaux de l'emoji —
 * `1f1f9-1f1f7.svg` pour 🇹🇷. Ces deux points de code se retraduisent en « TR »
 * par une soustraction : c'est la feuille de style elle-même qui dit quelle
 * classe porte quel pays, et il n'y a donc rien à tenir à jour à la main.
 *
 * Usage : npm run flags:generate
 *   (à relancer si `app/twemoji-amazing.css` est régénéré)
 */
import fs from "node:fs";
import path from "node:path";

const CSS = path.join(process.cwd(), "app", "twemoji-amazing.css");
const OUT = path.join(process.cwd(), "lib", "country-flags.generated.ts");

/** 🇹 = U+1F1F9 → « T ». */
const REGIONAL_INDICATOR_BASE = 0x1f1e6;

function isoFromCodepoints(codepoints) {
  const points = codepoints.split("-").map((hex) => parseInt(hex, 16));
  if (points.length !== 2) return null;

  const letters = points.map((point) => point - REGIONAL_INDICATOR_BASE);
  // Hors des 26 indicateurs régionaux, ce n'est pas un drapeau de pays : les
  // fanions régionaux (Écosse, Pays de Galles) sont des suites d'étiquettes,
  // et les drapeaux « thématiques » (arc-en-ciel, damier) n'ont pas d'ISO.
  if (letters.some((letter) => letter < 0 || letter > 25)) return null;

  return letters.map((letter) => String.fromCharCode(65 + letter)).join("");
}

const css = fs.readFileSync(CSS, "utf8");

// Une règle = un ou plusieurs sélecteurs, puis l'URL du SVG. Les alias comptent
// (`.twa-flag-china, .twa-flag-china-mainland`) : c'est le PREMIER sélecteur qui
// est retenu, celui que la bibliothèque considère comme le nom canonique.
const RULE = /((?:\.twa-flag-[a-z0-9-]+\s*,?\s*)+)\{[^}]*?\/svg\/([0-9a-f-]+)\.svg/g;

const flags = {};
let matches = 0;

for (const [, selectors, codepoints] of css.matchAll(RULE)) {
  const iso = isoFromCodepoints(codepoints);
  if (!iso) continue;

  const slug = selectors.match(/\.twa-flag-([a-z0-9-]+)/)[1];
  matches += 1;
  // Un même drapeau peut apparaître deux fois (Curaçao est écrit `AN` et `CW`
  // selon les données) : la première occurrence gagne, l'ordre du fichier étant
  // stable.
  flags[iso] ??= slug;
}

const entries = Object.entries(flags).sort(([a], [b]) => a.localeCompare(b));

const header = `// GÉNÉRÉ — ne pas modifier à la main.
// Source : app/twemoji-amazing.css, via scripts/generate-country-flags.mjs
// (npm run flags:generate). ${entries.length} pays.
//
// ⚠️ La clé est le CODE ISO du parc (\`Park.country\`), jamais le nom du pays :
// voir \`getCountryFlagClass\` dans lib/utils.ts.

export const COUNTRY_FLAG_SLUGS: Record<string, string> = {
`;

const body = entries.map(([iso, slug]) => `  ${iso}: "${slug}",`).join("\n");

fs.writeFileSync(OUT, `${header}${body}\n};\n`, "utf8");

console.log(
  `${entries.length} pays écrits dans lib/country-flags.generated.ts (${matches} règles de drapeau lues)`,
);
