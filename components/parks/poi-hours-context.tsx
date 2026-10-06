"use client";

import { createContext, useContext } from "react";
import { DateTime } from "luxon";
import { getLuxonFormat } from "@/lib/utils";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import type { PoiHoursSlot } from "@/types/poiHours";

type PoiHoursContextValue = {
  byPoi: ReadonlyMap<number, PoiHoursSlot[]>;
  timezone: string;
};

/**
 * Les heures d'ouverture du jour de la page de parc, pour les POPUPS.
 *
 * ⚠️ **Un contexte et non une prop** : les popups d'attraction et de POI sont
 * ouverts depuis quatre listes (temps d'attente, états, cartes d'événement,
 * grille des horaires), et leur faire descendre les heures aurait touché
 * chacune pour une donnée qu'aucune n'utilise. Hors page de parc (page dédiée
 * d'une attraction), pas de fournisseur : le popup n'a simplement pas de
 * section « Horaires du jour ».
 */
const PoiHoursContext = createContext<PoiHoursContextValue | null>(null);

export const PoiHoursProvider = PoiHoursContext.Provider;

/** Les créneaux du jour d'un POI et le fuseau du parc, ou `null`. */
export function usePoiHoursOf(poiId: number | null | undefined) {
  const context = useContext(PoiHoursContext);
  if (!context || poiId == null) return null;
  const slots = context.byPoi.get(poiId);
  return slots && slots.length > 0
    ? { slots, timezone: context.timezone }
    : null;
}

/** « 10:00 – 18:00 », un créneau par ligne, suivi de son nom s'il en a un. */
export function PoiHoursList({
  slots,
  timezone,
}: {
  slots: PoiHoursSlot[];
  timezone: string;
}) {
  const { is12Hour } = useTimeFormat();
  const format = getLuxonFormat(is12Hour);
  const time = (iso: string) =>
    DateTime.fromISO(iso, { zone: timezone }).toFormat(format);

  return (
    <ul className="flex flex-col gap-1 text-sm">
      {slots.map((slot) => (
        <li key={slot.openTime} className="flex items-baseline gap-2">
          <span className="font-medium tabular-nums">
            {time(slot.openTime)} – {time(slot.closeTime)}
          </span>
          {/* Nom de la source, non traduit : discret, comme une zone. */}
          {slot.label && (
            <span className="text-muted-foreground">{slot.label}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
