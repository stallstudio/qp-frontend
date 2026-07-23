import type { TemperatureUnit } from "@/hooks/useTemperatureUnit";

// Les températures sont STOCKÉES en Celsius (source Open-Meteo). Ces helpers ne
// servent qu'à l'AFFICHAGE selon la préférence de l'utilisateur.

export function convertFromCelsius(
  celsius: number,
  unit: TemperatureUnit,
): number {
  return unit === "fahrenheit" ? celsius * (9 / 5) + 32 : celsius;
}

export function temperatureUnitSymbol(unit: TemperatureUnit): string {
  return unit === "fahrenheit" ? "°F" : "°C";
}
