import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { buildParkLiveData } from "@/lib/park-live-data";
import type { QueueTime } from "@/types/waitTime";

export const runtime = "nodejs";
export const alt = "Queue Park";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Les vignettes de partage sont régénérées au plus toutes les 15 min : assez
// frais pour qu'un partage reflète l'affluence du moment, sans recalculer une
// image de 1200×630 à chaque aperçu (réseaux sociaux, messageries, aperçus de
// lien qui repassent en boucle).
export const revalidate = 900;

// Mêmes seuils que les pastilles de la liste (`lib/badge.tsx`).
function waitColor(minutes: number): string {
  if (minutes <= 20) return "#22c55e";
  if (minutes <= 40) return "#f59e0b";
  return "#ef4444";
}

/**
 * Vignette de partage d'une page parc. Au lieu de la cover brute (identique pour
 * tout le monde et muette), on affiche ce qui fait la valeur du site : le nom du
 * parc et l'état RÉEL de ses files au moment du partage.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ parkIdentifier: string; locale: string }>;
}) {
  const { parkIdentifier, locale } = await params;
  const t = await getTranslations({ locale, namespace: "og" });

  let parkName = "Queue Park";
  let openCount = 0;
  let averageWait: number | null = null;
  let busiest: { name: string; wait: number } | null = null;

  try {
    const live = await buildParkLiveData(parkIdentifier);

    if (live.status === "ok") {
      parkName = live.data.name;

      // On ne retient que les files standby réellement ouvertes : une attraction
      // fermée ou sans valeur fausserait la moyenne.
      const standby = live.data.waitTimes
        .map((wt) => ({
          name: wt.rideName,
          queue: wt.queues.find((q) => q.type === "standby"),
        }))
        .filter(
          (entry): entry is { name: string; queue: QueueTime } =>
            !!entry.queue &&
            entry.queue.status === "open" &&
            entry.queue.waitTime >= 0,
        );

      openCount = standby.length;
      if (openCount > 0) {
        averageWait = Math.round(
          standby.reduce((sum, e) => sum + e.queue.waitTime, 0) / openCount,
        );
        const top = standby.reduce((a, b) =>
          b.queue.waitTime > a.queue.waitTime ? b : a,
        );
        busiest = { name: top.name, wait: top.queue.waitTime };
      }
    }
  } catch {
    // Base injoignable : on dégrade vers la vignette « marque » plutôt que de
    // faire échouer le rendu de l'image (et donc l'aperçu du lien).
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0a0a0a 0%, #1c1917 100%)",
          padding: "72px",
          fontFamily: "sans-serif",
          color: "#fafafa",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              fontSize: 28,
              color: "#fa6847",
              fontWeight: 600,
            }}
          >
            Queue Park
          </div>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 700 }}>
            {parkName}
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#a1a1aa" }}>
            {t("subtitle")}
          </div>
        </div>

        {averageWait !== null ? (
          <div style={{ display: "flex", alignItems: "flex-end", gap: "64px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 24, color: "#a1a1aa" }}>
                {t("averageWait")}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 80,
                  fontWeight: 700,
                  color: waitColor(averageWait),
                }}
              >
                {averageWait} min
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 24, color: "#a1a1aa" }}>
                {t("openAttractions")}
              </div>
              <div style={{ display: "flex", fontSize: 80, fontWeight: 700 }}>
                {openCount}
              </div>
            </div>
            {busiest && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  maxWidth: "420px",
                }}
              >
                <div style={{ display: "flex", fontSize: 24, color: "#a1a1aa" }}>
                  {t("busiest")}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: 34,
                    fontWeight: 600,
                    lineHeight: 1.2,
                  }}
                >
                  {busiest.name} · {busiest.wait} min
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", fontSize: 34, color: "#a1a1aa" }}>
            {t("noLiveData")}
          </div>
        )}
      </div>
    ),
    size,
  );
}
