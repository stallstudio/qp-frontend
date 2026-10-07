import { ShowTime } from "@/types/show";

export type ShowTimeTableProps = {
  shows: ShowTime[];
  /**
   * Spectacles de l'événement SANS séance aujourd'hui (voir
   * `lib/event-pois.ts`), listés sous la grille. Seulement dans une carte
   * d'événement.
   */
  unscheduled?: ShowTime[];
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

export const PIXEL_PER_MINUTE = 2;
export const LANE_HEIGHT = 24;
export const MIN_ROW_HEIGHT = 40;
export const ROW_PADDING = 8;
export const MIN_WIDTH_FOR_TEXT_24H = 40;
export const MIN_WIDTH_FOR_TEXT_12H = 55;
// « 10:00 – 18:00 » : la plage entière d'une ouverture, quand elle tient.
export const MIN_WIDTH_FOR_RANGE_24H = 100;
export const MIN_WIDTH_FOR_RANGE_12H = 150;
