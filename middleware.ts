import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { legacyParkRedirects } from "./lib/legacy-redirects";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
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
  matcher: [
    "/",
    "/parks/:path*",
    "/(fr|en|de|ja|es|nl|it|ko|vi|sv|pl|zh|da|pt)/:path*",
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
