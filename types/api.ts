import { Group } from "./group";
import { OpeningHour } from "./openingHour";
import { ShowTime } from "./show";
import { WaitTime } from "./waitTime";

export type ParkLiveData = {
  identifier: string;
  name: string;
  timezone: string;
  cover: string[] | null;
  queueTypeLabels: Record<string, string> | null;
  openingHours: OpeningHour[];
  waitTimes: WaitTime[];
  shows: ShowTime[];
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
  cover: string[];
  badge?: string;
  country: string;
  group: Group;
  openingHours: OpeningHour[];
}
