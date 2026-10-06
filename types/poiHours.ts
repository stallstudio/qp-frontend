import type { PoiKind } from "@/lib/poi-kinds";

/** Un créneau d'ouverture, bornes en ISO 8601 (UTC). */
export type PoiHoursSlot = {
  openTime: string;
  closeTime: string;
  /**
   * Nom du créneau tel que la source le publie (« dinner » chez Efteling),
   * donc NON TRADUIT. `null` sur la quasi-totalité des créneaux.
   */
  label: string | null;
};

/**
 * Les heures d'ouverture du jour d'un POI — restaurant, boutique, attraction,
 * hôtel, service —, lues dans `poi_hours`.
 *
 * ⚠️ **Rien à voir avec les représentations** (`ShowTime`) : ici chaque créneau
 * est une PLAGE dont les deux bornes sont connues. Les spectacles gardent leur
 * table et leur type.
 */
export type PoiHours = {
  poiId: number;
  name: string;
  kind: PoiKind;
  /** Même règle que `WaitTime.eventId` : un POI tagué ne vit que dans sa carte d'événement. */
  eventId: number | null;
  banner: string | null;
  zone: string | null;
  menu: string | null;
  /** Triés par ouverture. */
  slots: PoiHoursSlot[];
};
