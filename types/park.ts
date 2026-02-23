import { Group } from "./group";
import { OpeningHour } from "./openingHour";
import { WaitTime } from "./waitTime";

//
// List of parks (home)
//

export type ParkListResponse = {
  parks: ParkList[];
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

//
// Park data (detail page)
//

export type ParkData = {
  identifier: string;
  name: string;
  cover: string[];
  timezone: string;
  openingHours: OpeningHour[];
  waitTimes: WaitTime[];
  lastUpdate: string;
};
//
// Misc
//

export type ParkStatus = "open" | "closed" | "unknown";
