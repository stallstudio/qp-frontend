import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

type Messages = Record<string, unknown>;

// Fusion PROFONDE : toute clé (à n'importe quel niveau) absente de la langue
// courante est reprise depuis l'anglais, plutôt que d'afficher une clé
// manquante. Nécessaire car certains namespaces sont PARTIELLEMENT traduits
// (ex. une nouvelle carte "about" ajoutée en fr/en) : un merge peu profond
// remplacerait tout le namespace et perdrait les nouvelles clés. La langue
// courante gagne toujours ; l'anglais ne fait que combler les trous.
function deepMerge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const baseValue = out[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      baseValue &&
      typeof baseValue === "object" &&
      !Array.isArray(baseValue)
    ) {
      out[key] = deepMerge(baseValue as Messages, value as Messages);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  const localeMessages = (await import(`../messages/${locale}.json`)).default;

  if (locale === "en") {
    return { locale: locale as string, messages: localeMessages };
  }

  const englishMessages = (await import(`../messages/en.json`)).default;

  return {
    locale: locale as string,
    messages: deepMerge(englishMessages as Messages, localeMessages as Messages),
  };
});
