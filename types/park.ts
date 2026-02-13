import { OpeningHour } from "./openingHour";
import { WaitTime } from "./waitTime";

export type ParkData = {
  identifier: string;
  name: string;
  cover: string[];
  timezone: string;
  openingHours: OpeningHour[];
  waitTimes: WaitTime[];
  lastUpdate: string;
};

export type ParkStatus = "open" | "closed" | "unknown";

export type Park = {
  id: number;
  identifier: string;
  name: string;
  timezone: string;
  cover: string[];
  badge: string | null;
  country: string | null;
  groupId: number;
  openingHours: OpeningHour[];
};

export type ParkGroup = {
  id: number;
  name: string;
};

export type ParksResponse = {
  parks: Park[];
  groups: ParkGroup[];
};
