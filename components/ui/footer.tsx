import { useTranslations } from "next-intl";
import LanguageSwitcher from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";

export default function Footer() {
  const t = useTranslations("footer");
  const currentYear = new Date().getFullYear();
  return (
    <footer className="py-4 flex sm:justify-between flex-col sm:flex-row gap-2 mt-48">
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
      <div className="flex items-center justify-center sm:justify-end gap-2 order-1 sm:order-2">
        <LanguageSwitcher />
        <span>|</span>
        <ThemeToggle />
      </div>
    </footer>
  );
}
