import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import type { Metadata } from "next";
import { TimeFormatProvider } from "@/components/providers/time-format-provider";
import { TemperatureUnitProvider } from "@/components/providers/temperature-unit-provider";
import AuthSessionProvider from "@/components/providers/session-provider";
import { UserProvider } from "@/components/providers/user-provider";
import { AuthGateProvider } from "@/components/providers/auth-gate-provider";
import { FavoritesProvider } from "@/components/providers/favorites-provider";
import { NotificationsProvider } from "@/components/providers/notifications-provider";
import CookieConsent from "@/components/cookie-consent";
import { getSiteUrl } from "@/lib/site-url";
import { headers } from "next/headers";
import { COUNTRY_HEADERS, regionalDefaults } from "@/lib/regional-defaults";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    title: {
      default: t("title"),
      template: t("titleTemplate"),
    },
    description: t("description"),
    keywords: t("keywords").split(", "),
    authors: [{ name: "Lilian G." }, { name: "Gaspard D." }],
    creator: "Queue Park",
    publisher: "Queue Park",
    applicationName: "Queue Park",
    category: "Travel",
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    metadataBase: new URL(getSiteUrl()),
    alternates: {
      canonical: "/",
    },
    openGraph: {
      type: "website",
      locale: locale,
      url: getSiteUrl(),
      title: t("ogTitle"),
      description: t("ogDescription"),
      siteName: "Queue Park",
      images: [
        {
          url: "/default_cover.webp",
          width: 1200,
          height: 630,
          alt: "Queue Park - Theme Park Wait Times",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("twitterTitle"),
      description: t("twitterDescription"),
      images: ["/default_cover.webp"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    icons: {
      icon: [
        { url: "/favicon.ico" },
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      ],
      apple: "/apple-touch-icon.png",
    },
    manifest: `/${locale}/manifest.webmanifest`,
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const messages = await getMessages();

  // ————— Défauts d'affichage, déduits de la REQUÊTE —————
  //
  // ⚠️ **Calculés ici et passés en props**, jamais lus dans le navigateur au
  // premier rendu : c'est ce qui supprime l'erreur d'hydratation des deux
  // providers, et ce qui sert du 12 h à un Américain dès la première image.
  // Le détail des règles est dans `lib/regional-defaults.ts`.
  //
  // ⚠️ **`headers()` rend ce layout DYNAMIQUE**, donc tout ce qu'il enveloppe.
  // Le coût est nul en pratique : l'accueil et la page d'un parc sont déjà en
  // `force-dynamic` (temps d'attente et classement des populaires sont vivants),
  // et il ne reste que quelques pages secondaires à ne plus pouvoir être
  // pré-rendues.
  //
  // ⚠️ **Conséquence pour un cache PARTAGÉ** : deux visiteurs de `/en/...` ne
  // reçoivent plus forcément le même HTML — `en-US` donne 12 h et Fahrenheit,
  // `en-GB` donne 24 h et Celsius. Un CDN posé devant l'application devrait donc
  // faire varier sur `accept-language` et l'en-tête de pays, ou ne pas mettre
  // ces pages en cache du tout (ce qui est le cas aujourd'hui).
  const requestHeaders = await headers();
  const defaults = regionalDefaults({
    locale,
    acceptLanguage: requestHeaders.get("accept-language"),
    countryCode: COUNTRY_HEADERS.map((name) => requestHeaders.get(name)).find(
      (value) => value !== null,
    ),
  });

  return (
    <NextIntlClientProvider messages={messages}>
      <TimeFormatProvider defaultFormat={defaults.timeFormat}>
        <TemperatureUnitProvider defaultUnit={defaults.temperatureUnit}>
          <AuthSessionProvider>
            <UserProvider>
              {/* AuthGateProvider avant FavoritesProvider : `useFavorites`
                  s'appuie sur le garde pour ouvrir le modal de connexion quand
                  un visiteur non connecté clique sur une étoile. */}
              <AuthGateProvider>
                <FavoritesProvider>
                  {/* Alertes/rappels actifs : alimente la cloche affichée sur
                      les lignes des listes attractions et spectacles. */}
                  <NotificationsProvider>
                    {children}
                    <CookieConsent />
                  </NotificationsProvider>
                </FavoritesProvider>
              </AuthGateProvider>
            </UserProvider>
          </AuthSessionProvider>
        </TemperatureUnitProvider>
      </TimeFormatProvider>
    </NextIntlClientProvider>
  );
}
