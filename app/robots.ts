import type { MetadataRoute } from "next";
import { getSiteUrl, isProductionSite } from "@/lib/site-url";

// robots.txt servi à la racine. On laisse tout le site indexable SAUF les routes
// techniques (API, endpoints de compte/cron) qui n'ont aucune valeur en
// résultat de recherche et ne feraient que gaspiller le budget de crawl.
//
// Hors production (dev.queue-park.com, préproduction…), tout est interdit :
// laisser indexer un environnement de test crée du contenu dupliqué qui
// concurrence la production sur ses propres pages.
export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();

  if (!isProductionSite()) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
