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

// Une ligne de réglage : icône + libellé à gauche, contrôle à droite, dans une
// mini-carte bordée. Uniformise la présentation (même gabarit pour chaque option)
// pour une lecture plus claire — moins « brouillon » qu'une simple pile de rangées.
function SettingRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-center gap-2 text-sm font-medium">
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </span>
      {children}
    </div>
  );
}

// Réglages du compte : langue, thème, format horaire. Chaque changement est
// appliqué immédiatement à l'UI et persisté (updatePreferences). Rendu SANS carte
// (le conteneur — la carte à onglets du profil — fournit la surface).
export default function PreferencesCard() {
  const t = useTranslations("profile");
  const { profile, updatePreferences } = useUser();

  const prefs = profile?.preferences;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Langue */}
      <SettingRow icon={<Globe className="size-4" />} label={t("language")}>
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
      </SettingRow>

      {/* Thème */}
      <SettingRow icon={<Palette className="size-4" />} label={t("theme")}>
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
      </SettingRow>

      {/* Format horaire */}
      <SettingRow icon={<Clock className="size-4" />} label={t("timeFormat")}>
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
      </SettingRow>
    </div>
  );
}
