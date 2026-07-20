"use client";

import { useTranslations } from "next-intl";
import ScrollShrinkHeader from "@/components/ui/scroll-shrink-header";

/**
 * En-tête de la page « À propos ». Mince wrapper autour de `ScrollShrinkHeader`
 * (mécanique partagée avec l'accueil / une page parc / le profil), qui ne fait
 * que fournir les libellés du namespace `about`.
 */
export default function AboutHeader() {
  const t = useTranslations("about");
  return (
    <ScrollShrinkHeader
      title={t("heroTitle")}
      subtitle={t("heroSubtitle")}
      backLabel={t("backHome")}
    />
  );
}
