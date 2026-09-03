import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import StatusScreen from "@/components/ui/status-screen";
import { routing } from "@/i18n/routing";

// 404 de dernier recours : atteinte quand l'URL ne correspond à AUCUNE locale
// (ex. `/xx/...`, ou le `notFound()` du layout `[locale]`). Aucun contexte
// next-intl n'est disponible ici — on retombe donc sur la langue par défaut,
// en dur, plutôt que d'afficher l'écran brut de Next.
export default function RootNotFound() {
  const isFrench = routing.defaultLocale === "fr";

  return (
    <StatusScreen
      icon={Compass}
      title={isFrench ? "Page introuvable" : "Page not found"}
      message={
        isFrench
          ? "Cette page n'existe pas ou a été déplacée."
          : "This page doesn't exist or has been moved."
      }
    >
      <a href={`/${routing.defaultLocale}`} className={buttonVariants()}>
        {isFrench ? "Retour à l'accueil" : "Back home"}
      </a>
    </StatusScreen>
  );
}
