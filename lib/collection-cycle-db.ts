import { getPrisma } from "@/lib/prisma";
import { cachedForTtl } from "@/lib/process-cache";
import { estimateCycle, type CycleEstimate } from "@/lib/collection-cycle";

/**
 * Lecture du cycle de collecte en base. La logique, elle, est dans
 * `lib/collection-cycle.ts` — même séparation que `park-closing` /
 * `park-closing-db` : ce qui se raisonne sans base se vérifie sans base.
 */

const WAIT_TIMES_JOB = "fetchParkWaitTimes";

/** Passages examinés : une heure. Le worker en fait un par minute, et le
 *  quantile de la phase a besoin d'assez de points pour ne pas osciller d'un
 *  appel à l'autre — une phase instable fait revenir le client trop tôt. */
const SAMPLE_SIZE = 60;

/** Durée de vie de l'état du cycle. Il est GLOBAL — une seule lecture pour tous
 *  les parcs et tous les visiteurs —, donc son coût est déjà négligeable ; dix
 *  secondes suffisent à ce qu'un pic de trafic n'en fasse pas une charge. */
const CYCLE_TTL_MS = 10_000;

/**
 * État du cycle, mesuré puis mis en cache dix secondes.
 *
 * ⚠️ **Ne lève jamais.** Une base injoignable rend un repli exploitable plutôt
 * qu'une erreur : le décompte de la page ne doit pas dépendre de la réussite de
 * cette lecture, sans quoi on aurait remplacé un décompte qui se fige par un
 * décompte qui plante.
 */
export async function readCollectionCycle(): Promise<CycleEstimate> {
  return cachedForTtl("collection-cycle:waitTimes", CYCLE_TTL_MS, async () => {
    try {
      const runs = await getPrisma().jobExecution.findMany({
        where: { jobName: WAIT_TIMES_JOB },
        orderBy: { startedAt: "desc" },
        take: SAMPLE_SIZE,
        // L'index `[jobName, startedAt]` couvre exactement ce tri.
        select: {
          startedAt: true,
          completedAt: true,
          durationMs: true,
          status: true,
        },
      });
      return estimateCycle(runs, Date.now());
    } catch (error) {
      console.error("Failed to read the collection cycle", error);
      // Sans mesure, `estimateCycle` rend le repli d'une minute : le pire cas
      // est l'ancien comportement en dur, jamais pire.
      return estimateCycle([], Date.now());
    }
  });
}
