"use client";

import { useTranslations } from "next-intl";
import { Globe, Palette, Clock } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGES } from "@/lib/locales";
import { useUser } from "@/components/providers/user-provider";
import type { ThemePreference } from "@/lib/user-preferences";
import type { TimeFormatType } from "@/components/providers/time-format-provider";

// Réglages du compte : langue, thème, format horaire. Chaque changement est
// appliqué immédiatement à l'UI et persisté (updatePreferences). Rendu SANS carte
// (le conteneur — la carte à onglets du profil — fournit la surface).
export default function PreferencesCard() {
  const t = useTranslations("profile");
  const { profile, updatePreferences } = useUser();

  const prefs = profile?.preferences;

  return (
    <div className="flex flex-col gap-5">
      {/* Langue */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Globe className="size-4 text-muted-foreground" />
            {t("language")}
          </span>
          <Select
            value={prefs?.locale}
            onValueChange={(value) => updatePreferences({ locale: value })}
          >
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  <span className="flex items-center gap-2">
                    <span>{lang.flag}</span>
                    <span>{lang.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Thème */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Palette className="size-4 text-muted-foreground" />
            {t("theme")}
          </span>
          <Select
            value={prefs?.theme}
            onValueChange={(value) =>
              updatePreferences({ theme: value as ThemePreference })
            }
          >
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">{t("themeSystem")}</SelectItem>
              <SelectItem value="light">{t("themeLight")}</SelectItem>
              <SelectItem value="dark">{t("themeDark")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Format horaire */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Clock className="size-4 text-muted-foreground" />
            {t("timeFormat")}
          </span>
          <Select
            value={prefs?.timeFormat}
            onValueChange={(value) =>
              updatePreferences({ timeFormat: value as TimeFormatType })
            }
          >
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">{t("timeFormat24")}</SelectItem>
              <SelectItem value="12h">{t("timeFormat12")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
    </div>
  );
}
