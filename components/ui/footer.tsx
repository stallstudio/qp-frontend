import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import LanguageSwitcher from "./language-switcher";
import FooterAuth from "./footer-auth";
import { AnimatedThemeToggler } from "./animated-theme-toggler";
import { buttonVariants } from "./button";
import { Link } from "@/i18n/routing";

export default function Footer() {
  const t = useTranslations("footer");
  const tAbout = useTranslations("about");
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
