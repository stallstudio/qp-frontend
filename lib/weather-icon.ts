import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  LucideIcon,
  Sun,
} from "lucide-react";

/**
 * Traduit un code WMO (Open-Meteo) en icône + clé i18n (namespace `weather`).
 * Table de correspondance : https://open-meteo.com/en/docs (WMO Weather codes).
 */
export type WeatherVisual = {
  Icon: LucideIcon;
  labelKey: string; // clé sous le namespace i18n `weather`
};

const UNKNOWN: WeatherVisual = { Icon: Cloud, labelKey: "unknown" };

export function getWeatherVisual(code: number | null | undefined): WeatherVisual {
  if (code == null) return UNKNOWN;

  switch (code) {
    case 0:
      return { Icon: Sun, labelKey: "clear" };
    case 1:
      return { Icon: Sun, labelKey: "mainlyClear" };
    case 2:
      return { Icon: CloudSun, labelKey: "partlyCloudy" };
    case 3:
      return { Icon: Cloud, labelKey: "overcast" };
    case 45:
    case 48:
      return { Icon: CloudFog, labelKey: "fog" };
    case 51:
    case 53:
    case 55:
    case 56:
    case 57:
      return { Icon: CloudDrizzle, labelKey: "drizzle" };
    case 61:
    case 63:
    case 65:
    case 66:
    case 67:
    case 80:
    case 81:
    case 82:
      return { Icon: CloudRain, labelKey: "rain" };
    case 71:
    case 73:
    case 75:
    case 77:
    case 85:
    case 86:
      return { Icon: CloudSnow, labelKey: "snow" };
    case 95:
    case 96:
    case 99:
      return { Icon: CloudLightning, labelKey: "thunderstorm" };
    default:
      return UNKNOWN;
  }
}
