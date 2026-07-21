import { ShowTime } from "@/types/show";

export type ShowTimeTableProps = {
  shows: ShowTime[];
  timezone: string;
  parkDate?: string | null;
  parkIdentifier: string;
  parkName: string;
};

export type ScheduleWithPosition = {
  schedule: ShowTime["schedules"][number];
  left: number;
  width: number;
  lane: number;
  duration: number;
};

export type ShowWithLanes = {
  show: ShowTime;
  // Clé stable et UNIQUE de la ligne (React key + layoutDependency). Le nom seul
  // ne suffit pas : deux spectacles peuvent porter le MÊME nom (ex. « Rencontre
  // avec les personnages » sur deux scènes) — on suffixe donc l'index de tri.
  uid: string;
  schedules: ScheduleWithPosition[];
  totalLanes: number;
};

export const PIXEL_PER_MINUTE = 2;
export const LANE_HEIGHT = 24;
export const MIN_ROW_HEIGHT = 40;
export const ROW_PADDING = 8;
export const MIN_WIDTH_FOR_TEXT_24H = 40;
export const MIN_WIDTH_FOR_TEXT_12H = 55;
