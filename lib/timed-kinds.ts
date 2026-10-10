import { getPrisma } from "@/lib/prisma";
import { cachedForTtl } from "@/lib/process-cache";
import { POI_KINDS, showsWaitTime, type PoiKind } from "@/lib/poi-kinds";
import type { WaitTime } from "@/types/waitTime";

// ————————————————————————————————————————————————————————————————————————
// LES FAMILLES DE POI DONT UN PARC COMMUNIQUE LES TEMPS D'ATTENTE
//
// Une alerte, qu'elle guette un seuil ou une réouverture, n'a de sens que sur
// un POI dont le parc publie l'attente. Sans elle, un seuil ne serait jamais
// franchi, et une « réouverture » ne serait que le témoin ouvert/fermé d'une
// source qui ne mesure rien.
//
// ⚠️ **L'instant ne suffit pas à le dire.** La nuit, plus aucune attraction
// n'affiche de minute, même à Disneyland : juger sur le direct seul aurait dit
// « ce parc ne communique pas de temps » à chaque fermeture. On regarde donc
// QUATORZE JOURS en arrière — un parc saisonnier ouvert deux week-ends sur
// trois y a encore ses temps —, et le direct en plus, pour qu'un parc ajouté
// hier ait ses alertes dès sa première minute publiée.
//
// ⚠️ **Le verdict de l'historique (`chronicallyUnavailable`) ne le disait
// pas.** Mesuré le 2026-10-09 : à Valleyfair, qui ne publie plus que des
// statuts depuis son passage chez Enchanted Parks, 44 attractions sur 57
// échappaient au verdict — trop peu de journées observées en arrière-saison —
// et leur popup proposait une alerte de seuil qui ne serait jamais partie.
//
// ⚠️ **Une attente « ouverte » seulement** (`status = open`, `waitTime >= 0`) :
// certaines sources écrivent 0 sur une attraction fermée, et `-1` est la
// valeur de toutes les sources qui ne mesurent rien.
//
// ⚠️ Les familles autres que les attractions doivent EN PLUS être déclarées
// dans `REAL_WAIT_TIMES` (`showsWaitTime`) : une constante d'ouverture (les
// « 5 min » des restaurants de Bellewaerde) passe ce filtre-ci sans être une
// attente pour autant.
// ————————————————————————————————————————————————————————————————————————

const LOOKBACK_MS = 14 * 24 * 60 * 60_000;

// Une heure : la réponse ne change qu'au rythme des saisons et des fournisseurs.
// Le direct, ajouté par-dessus, couvre ce que le cache n'a pas encore vu.
const TIMED_KINDS_TTL_MS = 60 * 60_000;

/** La file publie-t-elle une attente en ce moment ? */
function liveTimed(wt: WaitTime): boolean {
  return wt.queues.some((q) => q.status === "open" && q.waitTime >= 0);
}

/**
 * Les familles de POI du parc dont l'attente a été publiée récemment, parmi
 * celles qui peuvent en avoir une (`showsWaitTime`).
 *
 * Une requête par famille candidate — en pratique les attractions seules,
 * plus les restaurants des parcs déclarés —, chacune s'arrêtant au premier
 * relevé trouvé. Mise en cache une heure par parc et par instance.
 */
export async function getTimedKinds(
  parkId: number,
  parkIdentifier: string,
  live: WaitTime[] = [],
): Promise<PoiKind[]> {
  const candidates = POI_KINDS.filter((kind) =>
    showsWaitTime(parkIdentifier, kind),
  );

  let recent: PoiKind[] = [];
  try {
    recent = await cachedForTtl(
      `timed-kinds:${parkId}`,
      TIMED_KINDS_TTL_MS,
      async () => {
        const since = new Date(Date.now() - LOOKBACK_MS);
        const found = await Promise.all(
          candidates.map((kind) =>
            getPrisma()
              .waitTime.findFirst({
                where: {
                  parkId,
                  startTime: { gte: since },
                  status: "open",
                  waitTime: { gte: 0 },
                  poi: { kind },
                },
                select: { id: true },
              })
              .then((row) => (row ? kind : null)),
          ),
        );
        return found.filter((kind): kind is PoiKind => kind !== null);
      },
    );
  } catch {
    // Base injoignable : on ne conclut rien, toutes les familles candidates
    // gardent leurs alertes — la route de création tranchera.
    recent = candidates;
  }

  const timed = new Set(recent);
  for (const wt of live) {
    if (candidates.includes(wt.kind) && liveTimed(wt)) timed.add(wt.kind);
  }
  return candidates.filter((kind) => timed.has(kind));
}
