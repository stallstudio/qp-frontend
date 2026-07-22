"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { startThemeTransition, resolvesToDark } from "@/lib/theme-transition";
import { Globe, Clock, Palette, Sun, Moon, MonitorSmartphone } from "lucide-react";
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

// Réglages du compte — DIRECTION « contrôles tactiles » : on remplace les menus
// déroulants par des contrôles directs. Le thème devient trois vignettes
// (soleil / lune / écran) et l'heure un interrupteur segmenté ; on choisit d'un
// seul geste, sans ouvrir de menu. La langue reste un menu (14 langues).
// Rendu SANS carte (la carte à onglets du profil fournit la surface). Chaque
// changement est appliqué immédiatement à l'UI et persisté (updatePreferences).

// Ligne de réglage compacte : icône + libellé à gauche, contrôle à droite.
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

// Interrupteur segmenté avec pastille coulissante (même glissement que les
// onglets). La pastille est MESURÉE sur le bouton actif (offsetLeft/Width) plutôt
// que calculée en % : robuste quelles que soient les largeurs de libellés (14
// langues) et le point de rupture mobile / bureau.
function SlidingSegment<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | undefined;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  onChange: (v: T, el: HTMLButtonElement) => void;
}) {
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pill, setPill] = useState<{ left: number; width: number } | null>(
    null,
  );

  useEffect(() => {
    const measure = () => {
      const btn = value ? btnRefs.current[value] : null;
      if (!btn) return;
      const left = btn.offsetLeft;
      const width = btn.offsetWidth;
      // Ne re-rend que si la mesure a changé (sinon boucle : `options` est
      // recréé à chaque rendu → l'effet se relancerait indéfiniment).
      setPill((prev) =>
        prev && prev.left === left && prev.width === width
          ? prev
          : { left, width },
      );
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative flex w-full rounded-lg bg-muted p-1 text-sm sm:w-auto">
      {pill && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-1 top-1 rounded-md bg-background shadow-sm dark:border dark:border-input dark:bg-input/30"
          style={{
            left: pill.left,
            width: pill.width,
            transitionProperty: "left, width",
            transitionDuration: "400ms",
            transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
          }}
        />
      )}
      {options.map((o) => (
        <button
          key={o.value}
          ref={(el) => {
            btnRefs.current[o.value] = el;
          }}
          type="button"
          onClick={(e) => onChange(o.value, e.currentTarget)}
          aria-pressed={value === o.value}
          className={`relative z-10 flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors sm:flex-none ${
            value === o.value
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function PreferencesCard() {
  const t = useTranslations("profile");
  const { profile, updatePreferences } = useUser();

  const prefs = profile?.preferences;

  // Vignettes de thème (clair / sombre / système) — sélection au doigt.
  const themeOptions: {
    value: ThemePreference;
    label: string;
    icon: React.ReactNode;
  }[] = [
    { value: "light", label: t("themeLight"), icon: <Sun className="size-4" /> },
    { value: "dark", label: t("themeDark"), icon: <Moon className="size-4" /> },
    {
      value: "system",
      label: t("themeSystem"),
      icon: <MonitorSmartphone className="size-4" />,
    },
  ];

  const timeOptions: { value: TimeFormatType; label: string }[] = [
    { value: "24h", label: t("timeFormat24") },
    { value: "12h", label: t("timeFormat12") },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      {/* Thème — segment tactile compact (icône + libellé), sur la même rangée
          que le libellé (comme la maquette). Passe pleine largeur sur mobile. */}
      <SettingRow icon={<Palette className="size-4" />} label={t("theme")}>
        <SlidingSegment
          value={prefs?.theme}
          options={themeOptions}
          onChange={(v, el) => {
            const r = el.getBoundingClientRect();
            // Même révélation circulaire que le bouton du footer, émanant de
            // l'option cliquée. On applique la classe `dark` de façon synchrone
            // (next-themes est asynchrone) pour que la transition capture le
            // nouvel état ; updatePreferences persiste et garde next-themes en
            // phase.
            startThemeTransition(
              () => {
                document.documentElement.classList.toggle(
                  "dark",
                  resolvesToDark(v),
                );
                updatePreferences({ theme: v });
              },
              { x: r.left + r.width / 2, y: r.top + r.height / 2 },
            );
          }}
        />
      </SettingRow>

      {/* Format horaire — interrupteur segmenté 24 h / 12 h. */}
      <SettingRow icon={<Clock className="size-4" />} label={t("timeFormat")}>
        <SlidingSegment
          value={prefs?.timeFormat}
          options={timeOptions}
          onChange={(v) => updatePreferences({ timeFormat: v })}
        />
      </SettingRow>

      {/* Langue — menu (14 langues : un déroulant reste le plus lisible). */}
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
    </div>
  );
}
