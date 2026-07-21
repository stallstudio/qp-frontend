import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import type { Metadata } from "next";
import { TimeFormatProvider } from "@/components/providers/time-format-provider";
import AuthSessionProvider from "@/components/providers/session-provider";
import { UserProvider } from "@/components/providers/user-provider";
import { AuthGateProvider } from "@/components/providers/auth-gate-provider";
import CookieConsent from "@/components/cookie-consent";

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
    metadataBase: new URL("https://queue-park.com"),
    alternates: {
      canonical: "/",
    },
    openGraph: {
      type: "website",
      locale: locale,
      url: "https://queue-park.com",
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

  return (
    <NextIntlClientProvider messages={messages}>
      <TimeFormatProvider>
        <AuthSessionProvider>
          <UserProvider>
            <AuthGateProvider>
              {children}
              <CookieConsent />
            </AuthGateProvider>
          </UserProvider>
        </AuthSessionProvider>
      </TimeFormatProvider>
    </NextIntlClientProvider>
  );
}
