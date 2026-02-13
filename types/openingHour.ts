export type OpeningHour = {
  parkId: string;
  date: string; // Format: YYYY-MM-DD
  type: "standard" | "early_access" | "extension";
  openTime: string | null; // ISO 8601 date et heure
  closeTime: string | null; // ISO 8601 date et heure
};
