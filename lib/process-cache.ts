/**
 * Cache mémoire à durée de vie courte, partagé par toutes les requêtes servies
 * par UNE instance.
 *
 * ⚠️ **À ne pas confondre avec `cache()` de React**, qui mémoïse pour la durée
 * d'UNE requête. Les deux se composent : `cache()` évite qu'une même page émette
 * deux fois la requête, celui-ci évite que deux cents visiteurs du même parc
 * l'émettent deux cents fois dans la même seconde.
 *
 * ⚠️ **Le dédoublonnage des constructions EN VOL est la raison d'être du
 * module**, pas un raffinement. Sans lui, un cache froid sur un parc très
 * consulté laisse partir autant de constructions que de requêtes arrivées dans
 * l'intervalle — exactement la rafale qu'on cherche à supprimer. Ici la
 * première construit, les suivantes attendent la même promesse.
 *
 * ⚠️ **Par INSTANCE, et volontairement.** Rien n'est partagé entre replicas :
 * c'est un cache de confort sur une donnée qui se périme en quelques secondes,
 * pas une source de vérité. Deux instances peuvent construire chacune la leur,
 * ce qui divise la charge par le nombre de visiteurs, pas par le nombre
 * d'instances — largement suffisant.
 *
 * Une valeur n'est JAMAIS mise en cache si sa construction a échoué : une
 * panne de base ne doit pas être servie pendant dix secondes à tout le monde.
 */

type Entry = { expiresAt: number; value: unknown };

// Sur `globalThis` pour le même motif que le client Prisma : le rechargement à
// chaud du mode développement réévalue le module et perdrait le cache sinon.
const store = globalThis as unknown as {
  __processCache?: Map<string, Entry>;
  __processCacheInflight?: Map<string, Promise<unknown>>;
};

store.__processCache ??= new Map();
store.__processCacheInflight ??= new Map();

const entries = store.__processCache;
const inflight = store.__processCacheInflight;

/**
 * Purge paresseuse : sans elle, la clé d'un parc dépublié resterait en mémoire
 * pour la vie du processus. Déclenchée depuis les lectures, donc jamais sur un
 * minuteur qui empêcherait le processus de s'arrêter proprement.
 */
function pruneExpired(now: number): void {
  for (const [key, entry] of entries) {
    if (entry.expiresAt <= now) entries.delete(key);
  }
}

let lastPruneAt = 0;
const PRUNE_INTERVAL_MS = 60_000;

/**
 * Valeur en cache, ou construite puis mise en cache pour `ttlMs`.
 *
 * `build` n'est appelé que si rien de valide n'est en cache ET qu'aucune
 * construction n'est déjà en vol pour cette clé.
 *
 * `shouldCache` permet de ne PAS retenir certains résultats. Il existe pour les
 * échecs qui n'en sont pas au sens de l'exception : une construction qui rend
 * « base injoignable » ne doit pas figer cette réponse pour tout le monde
 * pendant la durée de vie du cache — la panne durerait alors plus longtemps que
 * sa cause.
 */
export async function cachedForTtl<T>(
  key: string,
  ttlMs: number,
  build: () => Promise<T>,
  shouldCache: (value: T) => boolean = () => true,
): Promise<T> {
  const now = Date.now();

  const hit = entries.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  if (now - lastPruneAt > PRUNE_INTERVAL_MS) {
    lastPruneAt = now;
    pruneExpired(now);
  }

  const promise = build()
    .then((value) => {
      if (shouldCache(value)) {
        entries.set(key, { expiresAt: Date.now() + ttlMs, value });
      }
      return value;
    })
    .finally(() => {
      // Retirée dans TOUS les cas : une construction échouée qui resterait en
      // vol ferait attendre indéfiniment toutes les requêtes suivantes.
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

/** Vide le cache. N'existe que pour les scripts et le développement. */
export function clearProcessCache(): void {
  entries.clear();
}
