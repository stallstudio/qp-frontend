import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

export const routing = defineRouting({
  locales: [
    "en",
    "fr",
    "de",
    "ja",
    "es",
    "nl",
    "it",
    "ko",
    "vi",
    "sv",
    "pl",
    "zh",
    "da",
    "pt",
  ],
  defaultLocale: "fr",
  localePrefix: "always",
});

export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
