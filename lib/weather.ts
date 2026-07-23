import { getPrisma } from "@/lib/prisma";
import { ParkWeather } from "@/types/api";

/**
 * Météo prévue du jour pour un parc, lue depuis la table `daily_weather`
 * (remplie par le worker via Open-Meteo). `date` est le jour logique du parc
 * (même résolution que les horaires). Retourne `null` si aucune donnée.
 */
export async function getWeatherByParkAndDate(
  parkId: number,
  date: string,
): Promise<ParkWeather | null> {
  try {
    const prisma = getPrisma();

    const row = await prisma.dailyWeather.findUnique({
      where: { parkId_date: { parkId, date } },
      select: { tempMin: true, tempMax: true, weatherCode: true },
    });

    if (!row) return null;
    // Ligne vide (aucune valeur) -> on considère qu'il n'y a pas de météo.
    if (row.tempMin == null && row.tempMax == null && row.weatherCode == null) {
      return null;
    }

    return {
      tempMin: row.tempMin,
      tempMax: row.tempMax,
      weatherCode: row.weatherCode,
    };
  } catch {
    return null;
  }
}
