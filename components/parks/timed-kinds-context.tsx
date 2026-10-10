"use client";

import { createContext, useContext } from "react";
import type { PoiKind } from "@/lib/poi-kinds";

/**
 * Les familles de POI dont le parc communique les temps d'attente
 * (`ParkLiveData.timedKinds`, voir `lib/timed-kinds.ts`), pour les POPUPS : ce
 * sont les seules où une alerte est proposée.
 *
 * ⚠️ **Un contexte et non une prop**, pour la même raison que
 * `PoiHoursProvider` : les popups sont ouverts depuis quatre listes, dont
 * aucune n'a l'usage de cette donnée.
 */
const TimedKindsContext = createContext<ReadonlySet<PoiKind> | null>(null);

export const TimedKindsProvider = TimedKindsContext.Provider;

/**
 * Le parc communique-t-il les temps d'attente de cette famille ? `true` hors
 * page de parc : on ne conclut pas d'une absence d'information, la route de
 * création tranchera.
 */
export function useCommunicatesTimes(kind: PoiKind | null | undefined): boolean {
  const kinds = useContext(TimedKindsContext);
  if (!kind) return false;
  return kinds === null || kinds.has(kind);
}
