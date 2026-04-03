import { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getPrisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://queue-park.com";
  const prisma = getPrisma();

  const parks = await prisma.park.findMany({
    where: {
      display: true,
    },
    select: {
      identifier: true,
      updatedAt: true,
    },
  });

  const locales = routing.locales;

  const routes: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    routes.push({
      url: `${baseUrl}/${locale}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
      alternates: {
        languages: Object.fromEntries(
          locales.map((l) => [l, `${baseUrl}/${l}`])
        ),
      },
    });

    for (const park of parks) {
      routes.push({
        url: `${baseUrl}/${locale}/park/${park.identifier}`,
        lastModified: park.updatedAt,
        changeFrequency: "hourly",
        priority: 0.8,
        alternates: {
          languages: Object.fromEntries(
            locales.map((l) => [l, `${baseUrl}/${l}/park/${park.identifier}`])
          ),
        },
      });
    }
  }

  return routes;
}
