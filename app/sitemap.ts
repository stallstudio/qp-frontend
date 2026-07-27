import { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getPrisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";

// La liste des parcs bouge quelques fois par mois, pas à chaque requête : sans
// revalidation, CHAQUE appel régénérait ~1 400 entrées (14 locales × ~100 parcs)
// et rejouait la requête SQL. On régénère au plus une fois par heure.
//
// Les liens profonds `/park/{parc}/ride/{slug}` n'y figurent VOLONTAIREMENT pas :
// ils servent la page du parc, les déclarer reviendrait à soumettre des dizaines
// d'URL au contenu identique.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();
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
        languages: {
          "x-default": `${baseUrl}/en`,
          ...Object.fromEntries(locales.map((l) => [l, `${baseUrl}/${l}`])),
        },
      },
    });

    for (const park of parks) {
      routes.push({
        url: `${baseUrl}/${locale}/park/${park.identifier}`,
        lastModified: park.updatedAt,
        changeFrequency: "hourly",
        priority: 0.8,
        alternates: {
          languages: {
            "x-default": `${baseUrl}/en/park/${park.identifier}`,
            ...Object.fromEntries(
              locales.map((l) => [
                l,
                `${baseUrl}/${l}/park/${park.identifier}`,
              ]),
            ),
          },
        },
      });
    }
  }

  return routes;
}
