import type { Metadata } from "next";
import { headers } from "next/headers";
import { after } from "next/server";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import ParkPageClient from "@/components/parks/park-page-client";
import ParkJsonLd from "@/components/parks/park-json-ld";
import HiddenParkNotice from "@/components/parks/hidden-park-notice";
import {
  buildParkLiveDataForViewer,
  resolveParkForViewer,
  type ParkIdentity,
} from "@/lib/park-live-data";
import { getRideIdentity, type RideIdentity } from "@/lib/ride-detail";
import { logParkRequest } from "@/lib/api-request-log";
import { parseRideSlug, rideSlug } from "@/lib/slug";

// LIEN PROFOND vers une attraction, pas une page distincte.
//
// Cette URL rend la page du parc EXACTEMENT comme `/park/{parc}`, avec le popup
// de l'attraction déjà ouvert. Elle existe pour deux usages :
//   - les notifications push (« l'attente est descendue sous 20 min ») ouvrent
//     directement l'attraction concernée ;
//   - un lien d'attraction est partageable.
//
// Le contenu servi étant celui de la page du parc, la balise canonique désigne
// la page du parc et ces URL ne sont PAS dans le sitemap : les indexer
// reviendrait à proposer à Google des dizaines d'adresses au contenu identique.
// Les vraies pages d'attraction sont sur Thrills.
export const dynamic = "force-dynamic";

type PageParams = {
  params: Promise<{
    parkIdentifier: string;
    rideSlug: string;
    locale: string;
  }>;
};

type Resolved =
  | { status: "ok"; park: ParkIdentity; ride: RideIdentity }
  | { status: "not-found" }
  | { status: "error" };

/**
 * Résout parc + attraction depuis les paramètres d'URL. Mémoïsé par `cache()` :
 * `generateMetadata`, la page et la vignette de partage passent ici sans
 * multiplier les requêtes.
 *
 * L'état `error` (base injoignable) est distingué de `not-found` : une panne
 * passagère ne doit pas répondre 404.
 */
async function resolve(parkIdentifier: string, slug: string): Promise<Resolved> {
  const rideId = parseRideSlug(slug);
  if (rideId === null) return { status: "not-found" };

  const park = await resolveParkForViewer(parkIdentifier);
  if (park === undefined) return { status: "error" };
  if (park === null) return { status: "not-found" };

  const ride = await getRideIdentity(park.id, rideId);
  if (ride === undefined) return { status: "error" };
  if (ride === null) return { status: "not-found" };

  return { status: "ok", park, ride };
}

export async function generateMetadata({
  params,
}: PageParams): Promise<Metadata> {
  const { parkIdentifier, rideSlug: slug, locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  const resolved = await resolve(parkIdentifier, slug);
  if (resolved.status !== "ok") return { title: t("title") };

  const { park, ride } = resolved;

  return {
    // Titre et description à l'attraction : c'est ce que voit celui qui reçoit
    // le lien (aperçu de partage, onglet du navigateur).
    title: {
      absolute: `${ride.name} — ${t("liveWaitTimes")} | ${park.name}`,
    },
    description: t("rideDescription", { ride: ride.name, park: park.name }),
    // Même filet que sur la page du parc : un parc masqué n'est servi qu'à un
    // admin, mais rien de ce qu'il contient n'a vocation à être indexé.
    ...(park.display ? {} : { robots: { index: false, follow: false } }),
    alternates: {
      // La page du parc, PAS cette URL : le contenu servi est le sien.
      canonical: `/${locale}/park/${parkIdentifier}`,
    },
    openGraph: {
      title: `${ride.name} | ${park.name}`,
      description: t("rideDescription", { ride: ride.name, park: park.name }),
      url: `/${locale}/park/${parkIdentifier}/ride/${rideSlug(
        ride.id,
        ride.name,
      )}`,
    },
    twitter: {
      card: "summary_large_image",
      title: `${ride.name} | ${park.name}`,
      description: t("rideDescription", { ride: ride.name, park: park.name }),
    },
  };
}

export default async function RideDeepLinkPage({ params }: PageParams) {
  const { parkIdentifier, rideSlug: slug, locale } = await params;
  const tPark = await getTranslations({ locale, namespace: "parkPage" });

  const [resolved, live] = await Promise.all([
    resolve(parkIdentifier, slug),
    buildParkLiveDataForViewer(parkIdentifier),
  ]);

  if (resolved.status === "not-found") notFound();
  // Base injoignable : on laisse remonter vers `error.tsx` plutôt que d'annoncer
  // une page disparue.
  if (resolved.status === "error") {
    throw new Error(`Ride deep link unavailable: ${parkIdentifier}/${slug}`);
  }
  const { park, ride } = resolved;

  // Le nom d'une attraction change (rebranding, sponsor, correction du
  // fournisseur). L'id reste la clé : toute ancienne forme d'URL continue de
  // fonctionner et redirige vers la forme courante — un lien partagé il y a six
  // mois ou une notification ancienne ne tombent jamais dans le vide.
  const canonicalSlug = rideSlug(ride.id, ride.name);
  if (slug !== canonicalSlug) {
    permanentRedirect(`/${locale}/park/${parkIdentifier}/ride/${canonicalSlug}`);
  }

  const headerList = await headers();
  after(() => {
    logParkRequest({
      endpoint: `/park/${parkIdentifier}/ride/${ride.id}`,
      parkId: parkIdentifier,
      ipAddress:
        headerList.get("x-forwarded-for")?.split(",")[0] ??
        headerList.get("x-real-ip") ??
        "unknown",
      userAgent: headerList.get("user-agent"),
      referer: headerList.get("referer"),
      statusCode: live.status === "ok" ? 200 : 500,
    });
  });

  return (
    <>
      {live.status === "ok" && (
        <ParkJsonLd
          park={live.data}
          city={park.city}
          country={park.country}
          latitude={park.latitude}
          longitude={park.longitude}
          locale={locale}
          homeLabel={tPark("backHome")}
        />
      )}
      <ParkPageClient
        parkIdentifier={parkIdentifier}
        initialData={live.status === "ok" ? live.data : null}
        initialRideId={ride.id}
      />
      {park.display === false && <HiddenParkNotice />}
    </>
  );
}
