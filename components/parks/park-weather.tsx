"use client";

import { useTranslations } from "next-intl";
import { ParkWeather as ParkWeatherType } from "@/types/api";
import { getWeatherVisual } from "@/lib/weather-icon";
import { useTemperatureUnit } from "@/hooks/useTemperatureUnit";
import {
  convertFromCelsius,
  temperatureUnitSymbol,
} from "@/lib/temperature";

type ParkWeatherProps = {
  weather: ParkWeatherType;
};

/**
 * Météo prévue du jour dans le header du parc : icône (condition) + plage de
 * températures « 18° – 26°C ». Se calque sur le style des horaires / heure
 * locale (ligne icône + texte blanc). L'icône porte le libellé de la condition
 * (title + aria-label) pour l'accessibilité.
 */
export default function ParkWeather({ weather }: ParkWeatherProps) {
  const t = useTranslations("weather");
  const { temperatureUnit } = useTemperatureUnit();
  const { Icon, labelKey } = getWeatherVisual(weather.weatherCode);
  const label = t(labelKey);

  const symbol = temperatureUnitSymbol(temperatureUnit);
  const min =
    weather.tempMin != null
      ? Math.round(convertFromCelsius(weather.tempMin, temperatureUnit))
      : null;
  const max =
    weather.tempMax != null
      ? Math.round(convertFromCelsius(weather.tempMax, temperatureUnit))
      : null;

  let tempText: string | null = null;
  if (min != null && max != null) tempText = `${min}° - ${max}${symbol}`;
  else if (max != null) tempText = `${max}${symbol}`;
  else if (min != null) tempText = `${min}${symbol}`;

  return (
    <div className="flex items-center gap-2 text-white" title={label}>
      <Icon className="w-4 h-4 shrink-0" aria-label={label} />
      <p>{tempText ?? label}</p>
    </div>
  );
}
