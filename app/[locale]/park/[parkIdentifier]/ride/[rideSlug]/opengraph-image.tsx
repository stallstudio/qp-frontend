import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { buildParkLiveData, getParkIdentity } from "@/lib/park-live-data";
import { getRideIdentity } from "@/lib/ride-detail";
import { parseRideSlug } from "@/lib/slug";

export const runtime = "nodejs";
export const alt = "Queue Park";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Même cadence que la vignette du parc : assez frais pour qu'un partage reflète
// l'attente du moment, sans recalculer l'image à chaque aperçu de lien.
export const revalidate = 900;

// Mêmes seuils que les pastilles de la liste (`lib/badge.tsx`).
function waitColor(minutes: number): string {
  if (minutes <= 20) return "#22c55e";
  if (minutes <= 40) return "#f59e0b";
  return "#ef4444";
}

/**
 * Vignette de partage d'une page attraction : le nom de l'attraction et son
 * temps d'attente RÉEL au moment du partage. C'est l'information qui donne
 * envie de cliquer — bien plus qu'une bannière générique.
 */
export default async function Image({
  params,
}: {
  params: Promise<{
    parkIdentifier: string;
    rideSlug: string;
    locale: string;
  }>;
}) {
  const { parkIdentifier, rideSlug, locale } = await params;
  const t = await getTranslations({ locale, namespace: "og" });

  let rideName = "Queue Park";
  let parkName = "";
  let wait: number | null = null;
  let closed = false;

  try {
    const rideId = parseRideSlug(rideSlug);
    const park = await getParkIdentity(parkIdentifier);

    if (rideId !== null && park) {
      parkName = park.name;
      const ride = await getRideIdentity(park.id, rideId);
      if (ride) {
        rideName = ride.name;

        const live = await buildParkLiveData(parkIdentifier);
        if (live.status === "ok") {
          const standby = live.data.waitTimes
            .find((wt) => wt.rideId === ride.id)
            ?.queues.find((q) => q.type === "standby");

          if (standby && standby.status === "open" && standby.waitTime >= 0) {
            wait = standby.waitTime;
          } else {
            closed = true;
          }
        }
      }
    }
  } catch {
    // Base injoignable : on dégrade vers la vignette « marque » plutôt que de
    // faire échouer l'aperçu du lien.
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
              fontSize: 28,
              color: "#fa6847",
              fontWeight: 600,
            }}
          >
            {parkName || "Queue Park"}
          </div>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 700 }}>
            {rideName}
          </div>
        </div>

        {wait !== null ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 24, color: "#a1a1aa" }}>
              {t("currentWait")}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 96,
                fontWeight: 700,
                color: waitColor(wait),
              }}
            >
              {wait} min
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", fontSize: 34, color: "#a1a1aa" }}>
            {closed ? t("rideClosed") : t("noLiveData")}
          </div>
        )}
      </div>
    ),
    size,
  );
}
