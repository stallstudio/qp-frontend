import { getPrisma } from "@/lib/prisma";

/**
 * Qui attend quoi, et une seule requête pour tout le monde.
 *
 * ————————————————————————————————————————————————————————————————————————
 * UNE SONNETTE, PAS UN FACTEUR
 * ————————————————————————————————————————————————————————————————————————
 * Ce module ne transporte AUCUNE donnée de parc. Il dit « le parc X a du
 * nouveau », et le navigateur refait son appel habituel à `/api/park/X`.
 *
 * ⚠️ C'est ce choix qui rend le direct inoffensif pour le reste du site :
 * - la forme des données reste définie à un seul endroit (`lib/park-live-data`),
 *   sans copie ici qui divergerait à la première évolution ;
 * - le rafraîchissement passe toujours par la route normale, donc le journal
 *   des consultations continue d'alimenter le classement des parcs populaires,
 *   et le filtrage IP / user-agent s'applique comme avant.
 * Un flux qui aurait poussé les données lui-même aurait cassé les trois.
 *
 * ————————————————————————————————————————————————————————————————————————
 * UNE SEULE REQUÊTE, QUEL QUE SOIT LE NOMBRE DE VISITEURS
 * ————————————————————————————————————————————————————————————————————————
 * ⚠️ **Ne jamais interroger la base par abonné.** Deux cents visiteurs en
 * attente feraient deux cents requêtes par seconde : bien pire que le sondage
 * qu'on cherche à remplacer. Ici un seul minuteur relève d'un coup les
 * `lastUpdatedAt` de tous les parcs écoutés — une requête par seconde pour tout
 * le site, sur une colonne déjà lue en permanence.
 *
 * ⚠️ **Il s'arrête tout seul quand personne n'écoute.** Un minuteur qui
 * tournerait la nuit ajouterait 86 400 requêtes par jour pour rien, et
 * empêcherait le processus de s'arrêter proprement.
 */

/** Rythme du relevé. Une seconde : c'est le grain le plus fin qui ait du sens
 *  pour une donnée écrite une fois par minute, et le coût reste une requête
 *  indexée sur quelques lignes. */
const WATCH_INTERVAL_MS = 1_000;

type Listener = (lastUpdate: string) => void;

// Sur `globalThis`, comme le client Prisma : le rechargement à chaud du mode
// développement réévaluerait le module et laisserait un minuteur orphelin
// derrière lui, avec ses abonnés.
const store = globalThis as unknown as {
  __parkWatchers?: Map<string, Set<Listener>>;
  __parkLastSeen?: Map<string, string | null>;
  __parkWatchTimer?: ReturnType<typeof setInterval> | null;
  __parkWatchBusy?: boolean;
};

store.__parkWatchers ??= new Map();
store.__parkLastSeen ??= new Map();
store.__parkWatchTimer ??= null;

const watchers = store.__parkWatchers;
const lastSeen = store.__parkLastSeen;

async function poll(): Promise<void> {
  // Un relevé qui traîne ne doit pas laisser le suivant s'empiler par-dessus :
  // sur une base lente, on accumulerait les requêtes en vol.
  if (store.__parkWatchBusy) return;

  const identifiers = [...watchers.keys()];
  if (identifiers.length === 0) {
    stopWatching();
    return;
  }

  store.__parkWatchBusy = true;
  try {
    const rows = await getPrisma().park.findMany({
      where: { identifier: { in: identifiers } },
      select: { identifier: true, lastUpdatedAt: true },
    });

    for (const row of rows) {
      const value = row.lastUpdatedAt?.toISOString() ?? null;
      const previous = lastSeen.get(row.identifier);
      lastSeen.set(row.identifier, value);

      // `previous === undefined` = premier relevé de ce parc : on mémorise sans
      // sonner. Les abonnés arrivés avant ont déjà été comparés à leur propre
      // `since` au moment de s'inscrire.
      if (previous === undefined || value === null || value === previous) {
        continue;
      }
      for (const listener of watchers.get(row.identifier) ?? []) {
        try {
          listener(value);
        } catch (error) {
          // Un abonné qui casse ne doit pas priver les autres du signal.
          console.error("Park update listener failed", error);
        }
      }
    }
  } catch (error) {
    // Une base momentanément injoignable ne doit pas arrêter la surveillance :
    // on retentera au tour suivant, et les clients ont de toute façon leur
    // décompte en filet.
    console.error("Failed to poll park updates", error);
  } finally {
    store.__parkWatchBusy = false;
  }
}

function startWatching(): void {
  if (store.__parkWatchTimer) return;
  const timer = setInterval(() => void poll(), WATCH_INTERVAL_MS);
  // Sans `unref`, ce minuteur retiendrait l'event loop et empêcherait le
  // processus de se terminer.
  timer.unref?.();
  store.__parkWatchTimer = timer;
}

function stopWatching(): void {
  if (!store.__parkWatchTimer) return;
  clearInterval(store.__parkWatchTimer);
  store.__parkWatchTimer = null;
  lastSeen.clear();
}

/**
 * S'abonne aux mises à jour d'un parc. Rend la fonction de désinscription.
 *
 * `since` est l'horodatage que le client a déjà en main. S'il est en retard sur
 * la base, l'abonné est prévenu immédiatement : sans ça, une écriture tombée
 * entre le rendu de la page et l'ouverture du flux passerait inaperçue et le
 * visiteur attendrait une minute pour rien.
 */
export function subscribeToPark(
  identifier: string,
  since: string | null,
  listener: Listener,
): () => void {
  let set = watchers.get(identifier);
  if (!set) {
    set = new Set();
    watchers.set(identifier, set);
  }
  set.add(listener);
  startWatching();

  const known = lastSeen.get(identifier);
  if (known != null && since != null && known !== since) {
    // Hors du flux d'exécution courant : l'appelant n'a pas encore eu le temps
    // de brancher sa réponse quand il nous appelle.
    queueMicrotask(() => listener(known));
  }

  return () => {
    const current = watchers.get(identifier);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      watchers.delete(identifier);
      lastSeen.delete(identifier);
    }
    if (watchers.size === 0) stopWatching();
  };
}

/** Nombre d'abonnés, tous parcs confondus. Pour le diagnostic. */
export function countParkSubscribers(): number {
  let total = 0;
  for (const set of watchers.values()) total += set.size;
  return total;
}
