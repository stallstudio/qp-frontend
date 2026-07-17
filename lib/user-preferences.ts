import { routing } from "@/i18n/routing";
import type { TimeFormatType } from "@/components/providers/time-format-provider";

// Contrat unique des préférences utilisateur, partagé backend <-> frontend.
// Pour ajouter une préférence : l'ajouter au schéma Prisma, ici (type + défaut +
// validation), et l'UI de la page Profil la consommera via le même objet.

export type ThemePreference = "light" | "dark" | "system";

export interface UserPreferences {
  locale: string;
  theme: ThemePreference;
  timeFormat: TimeFormatType;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  locale: routing.defaultLocale,
  theme: "system",
  timeFormat: "24h",
};

const THEMES: ThemePreference[] = ["light", "dark", "system"];

// L'enum Prisma stocke h12/h24 ; l'app manipule 12h/24h. Ces deux paires de
// helpers sont le seul point de traduction entre les deux.
export function timeFormatToDb(value: TimeFormatType): "h12" | "h24" {
  return value === "12h" ? "h12" : "h24";
}

export function timeFormatFromDb(value: "h12" | "h24"): TimeFormatType {
  return value === "h12" ? "12h" : "24h";
}

/**
 * Valide et normalise un patch de préférences venant du client. Ignore les
 * champs inconnus et les valeurs invalides (on ne fait confiance à rien côté
 * réseau). Renvoie uniquement les champs valides fournis.
 */
export function parsePreferencesPatch(
  input: unknown,
): Partial<UserPreferences> {
  if (!input || typeof input !== "object") return {};
  const data = input as Record<string, unknown>;
  const patch: Partial<UserPreferences> = {};

  if (
    typeof data.locale === "string" &&
    routing.locales.includes(data.locale as (typeof routing.locales)[number])
  ) {
    patch.locale = data.locale;
  }
  if (
    typeof data.theme === "string" &&
    THEMES.includes(data.theme as ThemePreference)
  ) {
    patch.theme = data.theme as ThemePreference;
  }
  if (data.timeFormat === "12h" || data.timeFormat === "24h") {
    patch.timeFormat = data.timeFormat;
  }

  return patch;
}
