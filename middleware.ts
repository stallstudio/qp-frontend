import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { legacyParkRedirects } from "./lib/legacy-redirects";
import {
  getClientIp,
  isBlacklisted,
  isUserAgentBlacklisted,
} from "./lib/ip-rules";
import { logParkRequest } from "./lib/dispatch";
import { BLOCKED_MESSAGE } from "./lib/api-disclaimer";
import { parseRideSlug } from "./lib/slug";

const intlMiddleware = createMiddleware(routing);

// Les deux pages qui journalisent leurs consultations : `/park/{parc}` et
// `/park/{parc}/ride/{slug}`, préfixe de langue compris (ou pas encore, avant
// que next-intl ne redirige).
const PARK_PAGE = new RegExp(
  `^(?:/(?:${routing.locales.join("|")}))?/park/([^/]+)(?:/ride/([^/]+))?/?$`,
);

/**
 * La requête tombe-t-elle sous une blacklist (IP ou user agent) ?
 *
 * ⚠️ **Le contrôle est ICI, et pas seulement dans les routes `/api/park/...`,
 * parce que les pages servent les mêmes données.** Depuis le rendu serveur, le
 * HTML de `/park/{parc}` contient les temps d'attente. Un robot n'a donc pas
 * besoin de l'API : relevé le 2026-10-27, `116.89.113.27` lisait la page
 * Universal Studios Singapore toutes les minutes depuis un mois, en 200, alors
 * que son IP était blacklistée depuis le 2026-10-05 et son user agent (`got`)
 * depuis le 2026-10-07. Il n'avait jamais appelé l'API.
 *
 * Les routes `/api/` restent hors du `matcher` : elles font leur propre
 * contrôle et répondent un 403 en JSON.
 *
 * ⚠️ **Une erreur ne bloque personne.** Ce contrôle passe devant TOUTES les
 * pages, y compris celles qui ne lisent aucune donnée : une API injoignable ne
 * doit pas faire tomber le site entier pour un anti-abus. `lib/ip-rules` sert
 * déjà ses règles en cache quand l'API ne répond plus (voir `refreshCache`).
 * Le `catch` ci-dessous ne sert qu'en dernier recours.
 */
async function isBlocked(request: NextRequest): Promise<boolean> {
  try {
    return (
      (await isBlacklisted(getClientIp(request))) ||
      (await isUserAgentBlacklisted(request.headers.get("user-agent")))
    );
  } catch (error) {
    console.error("Failed to check access rules", error);
    return false;
  }
}

function blockedResponse(request: NextRequest): NextResponse {
  // Le refus est journalisé comme les pages journalisent leurs consultations,
  // avec le même `endpoint` : la page Requests de l'admin voit alors le robot
  // passer à 0 % de succès au lieu de le voir disparaître. Les autres pages ne
  // journalisent rien, le refus non plus.
  const match = PARK_PAGE.exec(request.nextUrl.pathname);
  if (match) {
    const [, parkId, slug] = match;
    logParkRequest({
      endpoint: slug
        ? `/park/${parkId}/ride/${parseRideSlug(slug) ?? slug}`
        : `/park/${parkId}`,
      parkId,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      referer: request.headers.get("referer"),
      statusCode: 403,
    });
  }

  return new NextResponse(BLOCKED_MESSAGE, {
    status: 403,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // ⚠️ Un 403 mis en cache par Cloudflare serait servi à tout le monde.
      "Cache-Control": "no-store",
    },
  });
}

export default async function middleware(request: NextRequest) {
  if (await isBlocked(request)) {
    return blockedResponse(request);
  }

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/parks/")) {
    const legacyPath = pathname.replace(/^\/parks\//, "").replace(/\/+$/, "");
    const newSlug = legacyParkRedirects[legacyPath];

    const url = request.nextUrl.clone();
    url.pathname = newSlug ? `/park/${newSlug}` : "/";
    return NextResponse.redirect(url, 301);
  }

  return intlMiddleware(request);
}

export const config = {
  // Node et non Edge : le cache des règles de `lib/ip-rules` vit dans le
  // processus du serveur.
  runtime: "nodejs",
  matcher: [
    "/",
    "/parks/:path*",
    "/(fr|en|de|ja|es|nl|it|ko|vi|sv|pl|zh|da|pt)/:path*",
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
