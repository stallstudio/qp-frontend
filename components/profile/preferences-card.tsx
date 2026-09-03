"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import axios from "axios";
import { toast } from "sonner";
import { startThemeTransition, resolvesToDark } from "@/lib/theme-transition";
import {
  Globe,
  Clock,
  Palette,
  Sun,
  Moon,
  MonitorSmartphone,
  Thermometer,
  UserRound,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { TemperatureUnit } from "@/components/providers/temperature-unit-provider";

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

// Nom affiché du compte : seul réglage de cette carte qui ne passe pas par
// `updatePreferences` (il vit sur la ligne `users`, pas dans les préférences) et
// qui n'est donc PAS appliqué à la frappe — on valide explicitement, comme la
// rectification d'e-mail de la section confidentialité.
// Plafond aligné sur celui de l'API (app/api/user/name/route.ts) : au-delà, le
// nom déborderait de la pastille du compte.
const MAX_NAME_LENGTH = 60;

function DisplayNameRow() {
  const t = useTranslations("profile");
  const { profile, refresh } = useUser();
  const currentName = profile?.name ?? "";
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  // Le profil arrive de façon asynchrone : on recale le champ dès que le nom
  // connu change (chargement initial, refresh après sauvegarde).
  useEffect(() => {
    setName(profile?.name ?? "");
  }, [profile?.name]);

  const trimmed = name.trim();
  const changed = trimmed !== currentName.trim();

  const save = async () => {
    setSaving(true);
    try {
      await axios.patch("/api/user/name", { name: trimmed });
      // Rafraîchit le profil partagé : la pastille du compte (accueil) et le
      // « Content de vous revoir » reprennent le nouveau nom sans rechargement.
      await refresh();
      toast.success(t("displayNameSaved"));
    } catch {
      toast.error(t("displayNameError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingRow icon={<UserRound className="size-4" />} label={t("displayName")}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (changed && !saving) save();
        }}
        className="flex w-full items-center gap-2 sm:w-auto"
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME_LENGTH}
          autoComplete="given-name"
          placeholder={t("displayNamePlaceholder")}
          aria-label={t("displayName")}
          className="w-full sm:w-44"
        />
        <Button type="submit" disabled={!changed || saving} className="shrink-0">
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          {t("displayNameSave")}
        </Button>
      </form>
    </SettingRow>
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

  const temperatureOptions: { value: TemperatureUnit; label: string }[] = [
    { value: "celsius", label: t("temperatureCelsius") },
    { value: "fahrenheit", label: t("temperatureFahrenheit") },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      {/* Nom affiché — en tête : c'est l'identité du compte, le reste n'est que
          confort d'affichage. */}
      <DisplayNameRow />

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

      {/* Unité de température — interrupteur segmenté °C / °F. */}
      <SettingRow
        icon={<Thermometer className="size-4" />}
        label={t("temperatureUnit")}
      >
        <SlidingSegment
          value={prefs?.temperatureUnit}
          options={temperatureOptions}
          onChange={(v) => updatePreferences({ temperatureUnit: v })}
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
