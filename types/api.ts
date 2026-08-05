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
  // Nom ANGLAIS du pays, résolu CÔTÉ SERVEUR (`lib/parks-list.ts`). Ne pas le
  // recalculer dans un composant client : `Intl.DisplayNames` ne donne pas le
  // même résultat sous Node et dans le navigateur (voir `getCountryName`).
  //
  // ⚠️ **Ce n'est pas un libellé d'affichage, c'est la clé du DRAPEAU** :
  // `getCountryFlagClass` en tire `twa-flag-united-states`. Le traduire
  // effacerait tous les drapeaux. Pour afficher, utiliser `countryLabel`.
  countryName: string;
  // Le même pays dans la LANGUE DU VISITEUR, posé par `localizeCountries` en
  // dehors du cache de la liste (qui, lui, est partagé par les 14 langues).
  // Optionnel : les charges utiles qui ne passent pas par là — `/api/parks`,
  // servie derrière un cache commun — n'en portent pas.
  countryLabel?: string;
  group: Group;
  openingHours: OpeningHour[];
}
