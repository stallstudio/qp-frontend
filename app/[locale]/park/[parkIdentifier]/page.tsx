import type { Metadata } from "next";
import { headers } from "next/headers";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import ParkPageClient from "@/components/parks/park-page-client";
import ParkJsonLd from "@/components/parks/park-json-ld";
import HiddenParkNotice from "@/components/parks/hidden-park-notice";
import {
  buildParkLiveDataForViewer,
  resolveParkForViewer,
} from "@/lib/park-live-data";
import { logParkRequest } from "@/lib/api-request-log";
import { getClientIp } from "@/lib/ip-rules";

// Les temps d'attente sont par nature vivants : la page est rendue à chaque
// requête (le client prend ensuite le relais avec son rafraîchissement 60 s).
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ parkIdentifier: string; locale: string }>;
}): Promise<Metadata> {
  const { parkIdentifier, locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  const park = await resolveParkForViewer(parkIdentifier);
  if (!park) return { title: t("title") };

  // Aucune clé `images` ici, volontairement : la vignette est produite par
  // `opengraph-image.tsx` (nom du parc + affluence réelle), que Next rattache
  // automatiquement tant qu'on ne la surcharge pas.
  return {
    title: { absolute: `${park.name} | ${t("liveWaitTimes")}` },
    description: t("description"),
    // Un parc masqué n'est servi qu'à un admin — un robot reçoit un 404 et ne
    // verra jamais ces balises. Le `noindex` est un filet : la page est
    // `force-dynamic`, donc rendue à la demande, et une erreur de garde ne doit
    // pas se solder par une page non finie dans l'index.
    ...(park.display ? {} : { robots: { index: false, follow: false } }),
    alternates: {
      canonical: `/${locale}/park/${parkIdentifier}`,
    },
    openGraph: {
      title: `${park.name} | Queue Park`,
      description: t("ogDescription"),
      url: `/${locale}/park/${parkIdentifier}`,
    },
    twitter: {
      card: "summary_large_image",
      title: `${park.name} | Queue Park`,
      description: t("twitterDescription"),
    },
  };
}

export default async function ParkPage({
  params,
}: {
  params: Promise<{ parkIdentifier: string; locale: string }>;
}) {
  const { parkIdentifier, locale } = await params;
  const tPark = await getTranslations({ locale, namespace: "parkPage" });

  // Les données sont chargées ICI, côté serveur, en appelant directement la
  // couche métier (pas de requête HTTP de l'app vers sa propre API). Le HTML
  // servi contient donc les temps d'attente : c'est ce que voient les moteurs de
  // recherche, et c'est affiché sans attendre un aller-retour réseau.
  const [park, live] = await Promise.all([
    resolveParkForViewer(parkIdentifier),
    buildParkLiveDataForViewer(parkIdentifier),
  ]);

  // Vrai 404 HTTP, au lieu d'un 200 puis d'une redirection côté client.
  if (live.status === "not-found") {
    notFound();
  }

  // Le classement des « parcs populaires » compte les consultations. Le premier
  // affichage ne passant plus par la route API, c'est ici qu'il faut le compter,
  // sans quoi seuls les rafraîchissements seraient comptabilisés.
  //
  // `after()` exécute le journal APRÈS l'envoi de la réponse : rien de ce travail
  // n'entre dans le temps de rendu, et le log n'est pas rejoué si React re-rend
  // le composant.
  const headerList = await headers();
  after(() => {
    logParkRequest({
      endpoint: `/park/${parkIdentifier}`,
      parkId: parkIdentifier,
      // ⚠️ `getClientIp` et non les en-têtes lus à la main : depuis la bascule
      // Cloudflare du 2026-08-26, `x-forwarded-for` porte le datacenter et non
      // le visiteur. C'est cette page qui journalise le PREMIER affichage d'un
      // parc — la recopie qui vivait ici enregistrait donc de fausses adresses
      // sur la plus grosse part du trafic, pendant que la route corrigée en
      // enregistrait des bonnes.
      ipAddress: getClientIp(headerList),
      userAgent: headerList.get("user-agent"),
      referer: headerList.get("referer"),
      statusCode: live.status === "ok" ? 200 : 500,
    });
  });

  return (
    <>
      {live.status === "ok" && park && (
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
      {/* `initialData` null = base injoignable : le client réessaie et affiche
          son squelette, comme avant le passage en rendu serveur. */}
      <ParkPageClient
        parkIdentifier={parkIdentifier}
        initialData={live.status === "ok" ? live.data : null}
      />
      {park?.display === false && <HiddenParkNotice />}
    </>
  );
}
