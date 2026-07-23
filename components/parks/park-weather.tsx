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
 * Météo « live » dans le header du parc : icône (condition courante) +
 * température actuelle « 22°C ». Se calque sur le style des horaires / heure
 * locale (ligne icône + texte blanc). L'icône porte le libellé de la condition
 * (title + aria-label) pour l'accessibilité. Les min/max quotidiens ne sont
 * plus affichés (conservés en base pour d'éventuelles stats).
 */
export default function ParkWeather({ weather }: ParkWeatherProps) {
  const t = useTranslations("weather");
  const { temperatureUnit } = useTemperatureUnit();
  const { Icon, labelKey } = getWeatherVisual(weather.currentWeatherCode);
  const label = t(labelKey);

  const symbol = temperatureUnitSymbol(temperatureUnit);
  const current =
    weather.currentTemp != null
      ? Math.round(convertFromCelsius(weather.currentTemp, temperatureUnit))
      : null;

  const tempText = current != null ? `${current}${symbol}` : null;

  return (
    <div className="flex items-center gap-2 text-white" title={label}>
      <Icon className="w-4 h-4 shrink-0" aria-label={label} />
      <p>{tempText ?? label}</p>
    </div>
  );
}
