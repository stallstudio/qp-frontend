import { Group } from "./group";
import { OpeningHour } from "./openingHour";
import { ShowTime } from "./show";
import { WaitTime } from "./waitTime";

export type CoverImage = {
  url: string;
  credit: string | null;
};

export type ParkWeather = {
  // Météo « live » (affichée sur le front) : valeur courante + condition.
  currentTemp: number | null;
  currentWeatherCode: number | null; // Code WMO courant (voir lib/weather-icon.ts)
  // Prévision quotidienne (conservée pour d'éventuelles stats, plus affichée).
  tempMin: number | null;
  tempMax: number | null;
  weatherCode: number | null; // Code WMO (voir lib/weather-icon.ts)
};

export type ParkLiveData = {
  identifier: string;
  name: string;
  timezone: string;
  cover: CoverImage[] | null;
  queueTypeLabels: Record<string, string> | null;
  openingHours: OpeningHour[];
  waitTimes: WaitTime[];
  shows: ShowTime[];
  weather: ParkWeather | null;
  lastUpdate: string;
};

export type ParkListData = {
  parks: ParkList[];
  popularParks: string[];
};

export interface ParkList {
  identifier: string;
  name: string;
  timezone: string;
  cover: CoverImage[];
  badge?: string;
  country: string;
  group: Group;
  openingHours: OpeningHour[];
}
