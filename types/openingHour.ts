export interface OpeningHour {
  parkId: string;
  date: string;
  type: string;
  openTime?: string | null;
  closeTime?: string | null;
}
