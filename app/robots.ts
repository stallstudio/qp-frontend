import type { MetadataRoute } from "next";
import { getSiteUrl, isProductionSite } from "@/lib/site-url";

// robots.txt servi à la racine. On laisse tout le site indexable SAUF les routes
// techniques (API, endpoints de compte/cron) qui n'ont aucune valeur en
// résultat de recherche et ne feraient que gaspiller le budget de crawl.
//
// Hors production (dev.queue-park.com, préproduction…), tout est interdit :
// laisser indexer un environnement de test crée du contenu dupliqué qui
// concurrence la production sur ses propres pages.
//
// ⚠️ **Rendu à chaque requête, et c'est ce qui fait marcher la règle.** Sans
// cela, Next le fige au BUILD, sur GitHub Actions, où ni `AUTH_URL` ni
// `SITE_URL` n'existent : `getSiteUrl()` y retombe sur l'URL de production, et
// dev.queue-park.com servait le robots.txt de la production — `Allow: /` et
// `Host: https://queue-park.com` (relevé le 2026-10-30).
export const dynamic = "force-dynamic";

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
