"use client";

import { ChevronRight, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export type EventExtra = {
  id: number;
  name: string;
  /** Quartier ou salle, dans la langue de la source ; `null` = rien. */
  place: string | null;
};

/**
 * Les POI d'un événement que la source publie SANS la donnée de leur liste :
 * des spectacles sans séance (les maisons de Bellewaerde), des attractions
 * sans temps d'attente (des mazes que la source tague mais ne mesure pas, ou
 * plus). Une ligne par POI, qui ouvre le même popup que la liste au-dessus :
 * c'est là que se lisent le niveau de peur et le prix.
 *
 * ⚠️ **Pas de ligne vide dans la grille ou la table** : une timeline sans barre
 * ou un temps « – » se liraient comme « rien aujourd'hui » ou « fermé », alors
 * qu'on ne sait simplement pas.
 */
export default function EventExtrasList({
  items,
  heading,
  ariaLabel,
  onActivate,
}: {
  items: EventExtra[];
  /** Intertitre, seulement quand une liste « pleine » est juste au-dessus. */
  heading: string | null;
  ariaLabel: (name: string) => string;
  onActivate: (id: number) => void;
}) {
  return (
    <div className={cn(heading && "border-t")}>
      {heading && (
        <p className="px-3 pt-3 pb-1 text-[11px] font-medium text-muted-foreground">
          {heading}
        </p>
      )}
      <ul>
        {items.map((item, index) => (
          <li key={item.id} className={cn(index > 0 && "border-t")}>
            <button
              type="button"
              onClick={() => onActivate(item.id)}
              aria-label={ariaLabel(item.name)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--table-row-hover)]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{item.name}</span>
                {item.place && (
                  <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="size-3 shrink-0" aria-hidden="true" />
                    {item.place}
                  </span>
                )}
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
