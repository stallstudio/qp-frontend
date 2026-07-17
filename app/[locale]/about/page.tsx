import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import AboutPageClient from "@/components/about/about-page-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: "/about",
    },
    openGraph: {
      title: t("metaTitle"),
      description: t("metaDescription"),
      url: "https://queue-park.com/about",
    },
  };
}

export default function AboutPage() {
  return <AboutPageClient />;
}
