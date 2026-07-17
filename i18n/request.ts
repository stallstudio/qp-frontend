import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  const localeMessages = (await import(`../messages/${locale}.json`)).default;

  // Fallback anglais au niveau des namespaces : toute rubrique absente de la
  // langue courante (ex. "about", pas encore traduit partout) est reprise
  // depuis l'anglais plutôt que d'afficher une clé manquante. Merge peu profond
  // suffisant car chaque namespace est une clé de premier niveau complète.
  const fallbackMessages =
    locale === "en"
      ? localeMessages
      : (await import(`../messages/en.json`)).default;

  return {
    locale: locale as string,
    messages: { ...fallbackMessages, ...localeMessages },
  };
});
