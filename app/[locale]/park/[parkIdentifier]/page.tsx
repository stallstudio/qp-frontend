import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getPrisma } from "@/lib/prisma";
import ParkPageClient from "@/components/parks/park-page-client";

function getCoverUrl(cover: unknown): string | null {
  if (!cover || !Array.isArray(cover) || cover.length === 0) return null;
  const first = cover[0];
  if (typeof first === "string") return first;
  if (typeof first === "object" && first !== null && "url" in first) {
    return (first as { url: string }).url;
  }
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ parkIdentifier: string; locale: string }>;
}): Promise<Metadata> {
  const { parkIdentifier, locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  try {
    const prisma = getPrisma();
    const park = await prisma.park.findUnique({
      where: { identifier: parkIdentifier, display: true },
      select: { name: true, cover: true },
    });

    if (!park) {
      return { title: t("title") };
    }

    const coverUrl = getCoverUrl(park.cover);
    const ogImage = coverUrl ?? "/default_cover.webp";

    return {
      title: { absolute: `${park.name} | ${t("liveWaitTimes")}` },
      description: t("description"),
      alternates: {
        canonical: `/${locale}/park/${parkIdentifier}`,
      },
      openGraph: {
        title: `${park.name} | Queue Park`,
        description: t("ogDescription"),
        url: `/${locale}/park/${parkIdentifier}`,
        images: [{ url: ogImage, width: 1200, height: 630, alt: park.name }],
      },
      twitter: {
        card: "summary_large_image",
        title: `${park.name} | Queue Park`,
        description: t("twitterDescription"),
        images: [ogImage],
      },
    };
  } catch {
    return { title: t("title") };
  }
}

export default async function ParkPage({
  params,
}: {
  params: Promise<{ parkIdentifier: string; locale: string }>;
}) {
  const { parkIdentifier } = await params;
  return <ParkPageClient parkIdentifier={parkIdentifier} />;
}
