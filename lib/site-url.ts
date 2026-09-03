// URL publique du site, source unique.
//
// Elle était codée en dur (`https://queue-park.com`) dans le layout, robots.txt,
// le sitemap et les JSON-LD : sur dev.queue-park.com, toutes ces URL pointaient
// donc vers la production — canoniques fausses, fil d'Ariane faux, et un sitemap
// de dev annonçant les pages de prod.
//
// Ordre de résolution :
//   1. `SITE_URL` — à utiliser si l'URL publique doit diverger de celle d'Auth.js ;
//   2. `AUTH_URL` — déjà positionnée par environnement, donc juste par défaut ;
//   3. l'URL de production, filet de sécurité si rien n'est défini.
const PRODUCTION_URL = "https://queue-park.com";

export function getSiteUrl(): string {
  const raw = process.env.SITE_URL || process.env.AUTH_URL || PRODUCTION_URL;
  // Pas de barre finale : tout le code concatène `${siteUrl}/${locale}/...`.
  return raw.replace(/\/+$/, "");
}

/**
 * `true` uniquement sur le domaine de production.
 *
 * Sert à empêcher l'indexation des environnements de test : un dev accessible
 * publiquement et indexable ferait concurrence à la production sur ses propres
 * contenus (contenu dupliqué), et exposerait des pages non finies.
 */
export function isProductionSite(): boolean {
  return getSiteUrl() === PRODUCTION_URL;
}
