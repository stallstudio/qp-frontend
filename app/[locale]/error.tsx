"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Button, buttonVariants } from "@/components/ui/button";
import StatusScreen from "@/components/ui/status-screen";

// Frontière d'erreur d'une page localisée : remplace le contenu quand le rendu
// échoue, sans casser le layout (donc traductions et thème disponibles).
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errorPages");

  useEffect(() => {
    // Trace côté client : sans reporting d'erreurs, la console reste le seul
    // endroit où retrouver le `digest` correspondant au log serveur.
    console.error(error);
  }, [error]);

  return (
    <StatusScreen
      icon={TriangleAlert}
      title={t("errorTitle")}
      message={t("errorMessage")}
    >
      <Button onClick={reset}>{t("retry")}</Button>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        {t("backHome")}
      </Link>
    </StatusScreen>
  );
}
