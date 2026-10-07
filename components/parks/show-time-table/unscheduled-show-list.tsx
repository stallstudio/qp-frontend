"use client";

import { ChevronRight, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ShowTime } from "@/types/show";

/**
 * Les spectacles d'un événement qui n'ont AUCUNE séance publiée aujourd'hui —
 * les maisons hantées de Bellewaerde, que la source publie sans horaire. Une
 * ligne par spectacle, qui ouvre le même popup que la grille : c'est là que se
 * lisent le niveau de peur et le prix.
 *
 * ⚠️ **Pas de grille pour eux** : une ligne de timeline vide se lirait comme
 * « rien aujourd'hui », alors qu'on ne sait simplement pas quand.
 */
export default function UnscheduledShowList({
  shows,
  withHeading,
  onActivate,
}: {
  shows: ShowTime[];
  /** Un intertitre quand la grille des séances est juste au-dessus. */
  withHeading: boolean;
  onActivate: (show: ShowTime) => void;
}) {
  const t = useTranslations("showDetail");

  return (
    <div className={cn(withHeading && "border-t")}>
      {withHeading && (
        <p className="px-3 pt-3 pb-1 text-[11px] font-medium text-muted-foreground">
          {t("unscheduledTitle")}
        </p>
      )}
      <ul>
        {shows.map((show, index) => {
          const place = show.zone ?? show.venue;
          return (
            <li key={show.poiId} className={cn(index > 0 && "border-t")}>
              <button
                type="button"
                onClick={() => onActivate(show)}
                aria-label={t("openFor", { show: show.showName })}
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--table-row-hover)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {show.showName}
                  </span>
                  {place && (
                    <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <MapPin className="size-3 shrink-0" aria-hidden="true" />
                      {place}
                    </span>
                  )}
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
