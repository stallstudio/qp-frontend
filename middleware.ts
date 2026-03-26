import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: [
    "/",
    "/(fr|en|de|ja|es|nl|it|ko|vi|sv|pl|zh|da|pt)/:path*",
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
