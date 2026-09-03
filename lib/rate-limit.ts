// Limitation de débit minimaliste, EN MÉMOIRE (fenêtre glissante par clé).
//
// Volontairement sans dépendance ni Redis : l'application tourne dans un seul
// conteneur, et l'objectif n'est pas de bloquer un attaquant distribué mais
// d'empêcher qu'une simple boucle `curl` remplisse une table ou noie un webhook.
// Si le déploiement passe un jour à plusieurs instances, c'est ce module — et
// lui seul — qu'il faudra remplacer par un compteur partagé.

type Bucket = { hits: number[] };

const globalForRateLimit = globalThis as unknown as {
  rateLimitBuckets: Map<string, Bucket> | undefined;
};

function getBuckets(): Map<string, Bucket> {
  if (!globalForRateLimit.rateLimitBuckets) {
    globalForRateLimit.rateLimitBuckets = new Map();
  }
  return globalForRateLimit.rateLimitBuckets;
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  // Secondes avant qu'une nouvelle tentative soit acceptée (0 si autorisée).
  retryAfter: number;
};

/**
 * Consomme un jeton pour `key`. Autorise `limit` requêtes par fenêtre glissante
 * de `windowMs`.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const buckets = getBuckets();
  const now = Date.now();
  const cutoff = now - windowMs;

  const bucket = buckets.get(key) ?? { hits: [] };
  // On ne garde que les frappes encore dans la fenêtre : le tableau reste borné
  // par `limit` (au-delà on refuse sans rien ajouter).
  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket);
    const oldest = bucket.hits[0];
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);

  // Purge opportuniste : sans elle, la Map garderait une entrée par IP vue
  // depuis le démarrage du processus.
  if (buckets.size > 5_000) {
    for (const [k, b] of buckets) {
      if (b.hits.every((t) => t <= cutoff)) buckets.delete(k);
    }
  }

  return {
    allowed: true,
    remaining: limit - bucket.hits.length,
    retryAfter: 0,
  };
}
