import type { PrismaClient } from "@prisma/client";

/**
 * Fige la photo brute des APIs du parc au moment d'un signalement.
 *
 * Le worker enregistre en permanence la dernière réponse de chaque appel
 * d'API, par parc, dans `raw_api_latest` (voir `rawCaptureService` côté
 * worker). On n'a donc RIEN à appeler ici : il suffit de recopier ces lignes
 * dans `raw_api_captures` avant que le passage suivant ne les écrase.
 *
 * ⚠️ **La copie se fait ICI, dans la requête qui crée le signalement**, et pas
 * en confiant la tâche au worker par une file en base. La photo des temps
 * d'attente est réécrite chaque minute : le temps qu'un worker relise une file,
 * elle aurait déjà changé. Or c'est justement l'état que le visiteur avait sous
 * les yeux qu'on cherche à garder.
 *
 * ⚠️ **La recopie ne fait pas transiter les corps par Node.** Un `INSERT …
 * SELECT` déplace les blobs à l'intérieur de MySQL ; les lire puis les
 * réécrire depuis ici ferait traverser plusieurs mégaoctets à la requête HTTP
 * du visiteur, pour rien.
 *
 * ⚠️ **Aucune erreur ne remonte.** Un signalement qui n'aboutit pas parce que
 * sa photo a échoué serait un très mauvais compromis : c'est le signalement qui
 * compte, la photo n'est qu'un confort d'analyse.
 */
export async function captureRawSnapshotForReport(
  prisma: PrismaClient,
  reportId: number,
  parkIdentifier: string,
): Promise<void> {
  try {
    await prisma.$executeRaw`
      INSERT INTO raw_api_captures
        (triggerType, unknownStatusId, reportId, parkId, fetcher, seq, method, url,
         statusCode, contentType, durationMs, error, bodySize, bodyGzip, truncated,
         fetchedAt, capturedAt)
      SELECT
        'report', NULL, ${reportId}, parkId, fetcher, seq, method, url,
        statusCode, contentType, durationMs, error, bodySize, bodyGzip, truncated,
        fetchedAt, NOW()
      FROM raw_api_latest
      WHERE parkId = ${parkIdentifier}
    `;
  } catch (error) {
    console.error("Failed to capture raw API snapshot for report", error);
  }
}
