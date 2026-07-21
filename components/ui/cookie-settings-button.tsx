"use client";

import { useTranslations } from "next-intl";
import { openCookieSettings } from "@/lib/cookie-consent";

// Lien discret « Gérer les cookies » (footer) : rouvre le bandeau de consentement
// pour permettre de retirer/modifier le choix aussi facilement qu'il a été donné.
export default function CookieSettingsButton() {
  const t = useTranslations("cookies");
  return (
    <button
      type="button"
      onClick={openCookieSettings}
      className="cursor-pointer transition-colors hover:text-foreground"
    >
      {t("manage")}
    </button>
  );
}
