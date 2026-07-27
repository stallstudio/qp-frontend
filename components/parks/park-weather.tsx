"use client";

import { useTranslations } from "next-intl";
import { ParkWeather as ParkWeatherType } from "@/types/api";
import { getWeatherVisual } from "@/lib/weather-icon";
import { useTemperatureUnit } from "@/hooks/useTemperatureUnit";
import { ClickableTooltip } from "@/components/ui/clickable-tooltip";
import { convertFromCelsius, temperatureUnitSymbol } from "@/lib/temperature";

type ParkWeatherProps = {
  weather: ParkWeatherType;
};

/**
 * Météo « live » dans le header du parc : icône (condition courante) +
 * température actuelle « 22°C ». Se calque sur le style des horaires / heure
 * locale (ligne icône + texte blanc).
 *
 * Les min/max du jour sont déjà en base mais n'étaient pas affichés : ils sont
 * désormais montrés au survol (et au tact sur mobile) plutôt qu'en permanence,
 * pour ne pas surcharger un en-tête qui porte déjà le statut, les horaires et
 * l'heure locale.
 */
export default function ParkWeather({ weather }: ParkWeatherProps) {
  const t = useTranslations("weather");
  const { temperatureUnit } = useTemperatureUnit();
  const { Icon, labelKey } = getWeatherVisual(weather.currentWeatherCode);
  const label = t(labelKey);

  const symbol = temperatureUnitSymbol(temperatureUnit);
  const format = (celsius: number) =>
    `${Math.round(convertFromCelsius(celsius, temperatureUnit))}${symbol}`;

  const tempText =
    weather.currentTemp != null ? format(weather.currentTemp) : null;

  const content = (
    <>
      <Icon className="w-4 h-4 shrink-0" aria-label={label} />
      <p>{tempText ?? label}</p>
    </>
  );

  const hasRange = weather.tempMin != null && weather.tempMax != null;

  // Sans min/max connus, aucun tooltip : mieux vaut rien qu'une infobulle vide.
  if (!hasRange) {
    return (
      <div className="flex items-center gap-2 text-white" title={label}>
        {content}
      </div>
    );
  }

  return (
    <ClickableTooltip
      content={
        <span className="whitespace-nowrap">
          {label} · {t("min")} {format(weather.tempMin!)} · {t("max")}{" "}
          {format(weather.tempMax!)}
        </span>
      }
    >
      <button
        type="button"
        className="flex cursor-help items-center gap-2 text-white"
      >
        {content}
      </button>
    </ClickableTooltip>
  );
}
