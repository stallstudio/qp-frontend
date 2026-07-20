import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";

// Manifeste PWA localisé, un par langue. Le site étant multilingue (URLs toujours
// préfixées `/{locale}/`), chaque locale sert son propre manifeste : `name`,
// `description` et raccourcis traduits, `lang`/`start_url` cohérents avec la
// langue. Le `<link rel="manifest">` est posé par le layout (voir generateMetadata
// → `manifest: /{locale}/manifest.webmanifest`).
//
// i18n : seuls fr + en sont traduits pour l'instant ; les autres langues
// retombent sur l'anglais via le merge `{ ...en, ...locale }` de i18n/request.ts.
export const dynamic = "force-static";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "manifest" });

  const manifest = {
    id: `/${locale}`,
    name: t("name"),
    short_name: t("shortName"),
    description: t("description"),
    lang: locale,
    dir: "ltr",
    start_url: `/${locale}`,
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    categories: ["travel", "entertainment", "lifestyle", "utilities"],
    theme_color: "#ffffff",
    background_color: "#ffffff",
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
    shortcuts: [
      {
        name: t("shortcutAllParks"),
        short_name: t("shortcutParksShort"),
        url: `/${locale}`,
      },
    ],
  };

  return Response.json(manifest, {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
