import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import LanguageSwitcher from "./language-switcher";
import FooterAuth from "./footer-auth";
import { AnimatedThemeToggler } from "./animated-theme-toggler";
import { buttonVariants } from "./button";
import CookieSettingsButton from "./cookie-settings-button";
import { Link } from "@/i18n/routing";

export default function Footer() {
  const t = useTranslations("footer");
  const tAbout = useTranslations("about");
  const tCookies = useTranslations("cookies");
  const currentYear = new Date().getFullYear();
  return (
    <footer
      className="py-4 flex sm:justify-between flex-col sm:flex-row gap-2 w-full"
      id="footer"
    >
      <div className="flex flex-col order-2 sm:order-1">
        <div className="text-sm text-muted-foreground text-center sm:text-start">
          {t("copyright", { year: currentYear })}
        </div>

        <p className="text-sm text-muted-foreground text-center sm:text-start">
          {t("contactText")}{" "}
          <a
            href="mailto:contact@queue-park.com"
            className="hover:text-primary transition-colors duration-300"
          >
            contact@queue-park.com
          </a>
          .
        </p>

        {/* Liens légaux discrets (RGPD/CNIL). */}
        <div className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground sm:justify-start">
          <Link
            href="/mentions-legales"
            className="transition-colors hover:text-foreground"
          >
            {tCookies("legalNotice")}
          </Link>
          <span aria-hidden>·</span>
          <Link
            href="/confidentialite"
            className="transition-colors hover:text-foreground"
          >
            {tCookies("privacyPolicy")}
          </Link>
          <span aria-hidden>·</span>
          <Link
            href="/cookies"
            className="transition-colors hover:text-foreground"
          >
            {tCookies("cookiePolicy")}
          </Link>
          <span aria-hidden>·</span>
          <CookieSettingsButton />
        </div>
      </div>
      {/* Ordre : compte, À propos | langue, thème. Le « | » ne sert plus qu'à
          séparer les catégories (compte/navigation vs préférences). */}
      <div className="flex flex-wrap items-center justify-center gap-2 order-1 sm:order-2 sm:justify-end">
        <FooterAuth />
        <Link
          href="/about"
          className={buttonVariants({ variant: "secondary" })}
        >
          <Info className="size-4" />
          {tAbout("metaTitle")}
        </Link>
        <span className="text-muted-foreground">|</span>
        <LanguageSwitcher />
        <AnimatedThemeToggler
          className={buttonVariants({ variant: "secondary" })}
        />
      </div>
    </footer>
  );
}
