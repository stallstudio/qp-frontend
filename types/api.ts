import { Group } from "./group";
import { OpeningHour } from "./openingHour";
import { ParkEventDto } from "./parkEvent";
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
  /**
   * Événements saisonniers du parc (Halloween, Noël). Tableau VIDE onze mois par
   * an — et dans ce cas le comportement de la page est strictement celui
   * d'avant leur introduction.
   */
  events: ParkEventDto[];
  /**
   * Horodatage de la DONNÉE : quand le worker a écrit ces temps d'attente.
   * Sert à dire « ces valeurs datent de… », jamais à prévoir la suite — c'est
   * `nextUpdateIn` qui porte cette question (voir `lib/collection-cycle.ts`).
   */
  lastUpdate: string;
  /**
   * Secondes à attendre avant de redemander ces données, mesurées sur la
   * cadence RÉELLE du worker et étalées d'un jitter propre à chaque réponse.
   *
   * ⚠️ **Une durée, pas un instant** : l'horloge d'un téléphone peut être
   * décalée de plusieurs minutes, ce qui fausserait toute échéance absolue.
   * ⚠️ **Se périme vite** : recalculée à chaque réponse servie, elle n'est
   * jamais mise en cache avec le reste de l'objet.
   */
  nextUpdateIn: number;
  /**
   * Âge de la donnée en secondes, AU MOMENT OÙ LA RÉPONSE EST SERVIE.
   *
   * ⚠️ **Une durée et non un instant, pour la même raison que `nextUpdateIn`** :
   * l'horloge d'un téléphone peut être décalée de plusieurs minutes, et
   * `lastUpdate` seul donnerait alors un âge absurde. Le client part de cette
   * valeur et la fait vieillir avec sa propre horloge, qui est juste pour
   * mesurer un écoulement même si elle est fausse pour donner l'heure.
   *
   * ⚠️ C'est aussi ce qui évite une erreur d'hydratation : au premier rendu,
   * serveur et navigateur affichent tous deux exactement cette valeur.
   */
  dataAgeSeconds: number;
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
