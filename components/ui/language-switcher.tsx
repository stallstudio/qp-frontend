"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { Check, Languages, Clock, Thermometer } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "./button";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { useTemperatureUnit } from "@/hooks/useTemperatureUnit";
import { LANGUAGES as languages } from "@/lib/locales";

interface LanguageSwitcherProps {
  showText?: boolean;
  onLanguageChange?: () => void;
}

export default function LanguageSwitcher({
  showText = true,
  onLanguageChange,
}: LanguageSwitcherProps) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { timeFormat, toggleTimeFormat } = useTimeFormat();
  const { temperatureUnit, toggleUnit } = useTemperatureUnit();

  const t = useTranslations("settings");

  const handleLanguageChange = (newLocale: string) => {
    onLanguageChange?.();
    router.replace(pathname, { locale: newLocale });
  };

  const currentLanguage = languages.find((lang) => lang.code === locale);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary">
          <Languages />
          {showText && currentLanguage?.name}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            className="flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span>{language.flag}</span>
              <span>{language.name}</span>
            </span>
            {locale === language.code && (
              <Check className="size-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={toggleTimeFormat}
          className="flex items-center justify-between cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Clock className="size-4" />
            <span>{t("timeFormat")}</span>
          </span>
          <span className="text-muted-foreground text-sm">
            {timeFormat === "12h" ? "12h" : "24h"}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={toggleUnit}
          className="flex items-center justify-between cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Thermometer className="size-4" />
            <span>{t("temperatureUnit")}</span>
          </span>
          <span className="text-muted-foreground text-sm">
            {temperatureUnit === "fahrenheit" ? "°F" : "°C"}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
