import { getTranslations } from "next-intl/server";
import { Compass } from "lucide-react";
import { Link } from "@/i18n/routing";
import { buttonVariants } from "@/components/ui/button";
import StatusScreen from "@/components/ui/status-screen";

// 404 à l'intérieur d'une locale : rendue dans le layout `[locale]`, donc
// traduite et cohérente avec le reste du site.
export default async function LocaleNotFound() {
  const t = await getTranslations("errorPages");

  return (
    <StatusScreen
      icon={Compass}
      title={t("notFoundTitle")}
      message={t("notFoundMessage")}
    >
      <Link href="/" className={buttonVariants()}>
        {t("backHome")}
      </Link>
    </StatusScreen>
  );
}
