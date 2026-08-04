import { getPrisma } from "@/lib/prisma";

// Journal des consultations de parcs (`api_request_logs`).
//
// Il alimente le classement des « parcs populaires » (`GET /api/parks` agrège
// les 2 dernières heures). Deux règles :
//
// 1. **Jamais dans le chemin critique.** L'écriture était `await`ée avant de
//    répondre : chaque réponse — donc chaque rafraîchissement, toutes les 60 s
//    et par onglet ouvert — attendait un INSERT dont personne n'a besoin en
//    temps réel.
// 2. **Jamais bloquant en cas d'erreur.** Un journal qui échoue ne doit pas
//    empêcher un utilisateur de voir les temps d'attente.

export type ParkRequestLogEntry = {
  endpoint: string;
  parkId: string | null;
  ipAddress: string;
  userAgent: string | null;
  referer: string | null;
  statusCode: number;
};

/**
 * Enregistre une consultation SANS attendre l'écriture (fire-and-forget).
 *
 * Volontairement non `async` : le type de retour `void` empêche un appelant de
 * l'`await` par réflexe et de réintroduire la latence qu'on vient de supprimer.
 */
export function logParkRequest(entry: ParkRequestLogEntry): void {
  void getPrisma()
    .apiRequestLog.create({ data: entry })
    .catch((error) => {
      console.error("Failed to log API request", error);
    });
}

// Rétention du journal. Le classement des « parcs populaires » ne regarde que
// les 2 dernières heures ; c'est l'ADMIN qui consomme l'historique long (page
// Requests, dont les fenêtres vont jusqu'à 30 jours).
//
// ⚠️ 7 jours auparavant, et c'était trop court sans que rien ne le dise : la
// fenêtre « Last 30 days » de l'admin ramenait exactement la même chose que
// « Last 7 days » (mesuré : 14 672 IPs contre 14 771, l'écart n'étant que le
// reliquat non encore purgé), ce qui se lisait comme un bug de comptage.
// 30 jours aligne la rétention sur la plus large fenêtre proposée.
//
// Ordre de grandeur à la nouvelle valeur : ~19 000 lignes/jour observées, soit
// ~570 000 lignes en régime stable. Le `groupBy` de l'accueil reste borné à 2 h
// par l'index `createdAt`, il n'est donc pas affecté.
// Ajustable par `API_LOG_RETENTION_DAYS`.
const DEFAULT_RETENTION_DAYS = 30;

export function getLogRetentionDays(): number {
  const raw = Number(process.env.API_LOG_RETENTION_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_RETENTION_DAYS;
}

// Le cron des alertes tourne toutes les 1-2 min ; purger à chaque passage
// n'aurait aucun intérêt (la rétention se compte en jours) et lancerait un DELETE
// inutile en continu. On n'y touche qu'une fois par heure.
const PURGE_INTERVAL_MS = 60 * 60_000;
// Plafond par passage : sur une table jamais purgée, un DELETE massif
// verrouillerait la table longtemps. Le rattrapage se fait donc par tranches, au
// fil des passages horaires.
const PURGE_BATCH = 10_000;

const globalForPurge = globalThis as unknown as {
  lastLogPurgeAt: number | undefined;
};

/**
 * Purge les entrées plus anciennes que la rétention. Appelée par le cron des
 * alertes : pas besoin d'une planification dédiée. Renvoie le nombre de lignes
 * supprimées, ou `null` si le passage a été sauté (purge déjà faite récemment).
 */
export async function purgeOldRequestLogs(): Promise<number | null> {
  const last = globalForPurge.lastLogPurgeAt;
  if (last != null && Date.now() - last < PURGE_INTERVAL_MS) return null;
  globalForPurge.lastLogPurgeAt = Date.now();

  const cutoff = new Date(
    Date.now() - getLogRetentionDays() * 24 * 60 * 60 * 1000,
  );

  try {
    const { count } = await getPrisma().apiRequestLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
      limit: PURGE_BATCH,
    });
    return count;
  } catch (error) {
    console.error("Failed to purge API request logs", error);
    return 0;
  }
}
