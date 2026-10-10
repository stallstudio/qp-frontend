"use client";

import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export type EventExtra = {
  id: number;
  name: string;
  /** Favori du visiteur : épinglé en tête, étoile devant le nom. */
  favorite?: boolean;
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
 *
 * ⚠️ **Mêmes lignes que la liste du parc** (2026-10-09) : le nom seul, au bord,
 * sans zone ni chevron. Le retrait, le quartier et la flèche en faisaient une
 * liste d'un autre genre, juste au-dessus de la table qu'elle complète.
 *
 * L'intertitre a la forme d'un en-tête de colonne (`h-10 border-b`, comme
 * celui de la table et la ligne des heures de la grille) : une petite table
 * sous la grande, détachée par de l'air plutôt que par un filet au-dessus.
 *
 * ⚠️ **Les favoris y sont épinglés comme partout ailleurs** (2026-10-10) :
 * étoile devant le nom, en tête de liste, trait épais sous le dernier. Les
 * maisons d'IBILAW, que Walibi Belgium ne mesure pas, ne vivent QUE dans cette
 * liste : une maison mise en favori y restait à sa place alphabétique, alors
 * qu'elle remontait bien dans la grille des horaires.
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
  const tFav = useTranslations("favorites");
  // Tri STABLE : les favoris passent devant, chaque groupe garde l'ordre reçu.
  const sorted = [
    ...items.filter((item) => item.favorite),
    ...items.filter((item) => !item.favorite),
  ];
  const favCount = items.filter((item) => item.favorite).length;
  const hasFavBoundary = favCount > 0 && favCount < sorted.length;

  return (
    <div className={cn("text-sm", heading && "mt-5")}>
      {heading && (
        <p className="flex h-10 items-center border-b font-medium text-muted-foreground">
          {heading}
        </p>
      )}
      <ul>
        {sorted.map((item, index) => (
          <li
            key={item.id}
            className={cn(
              index > 0 &&
                (hasFavBoundary && index === favCount
                  ? "border-t-[3px] border-border"
                  : "border-t"),
            )}
          >
            <button
              type="button"
              onClick={() => onActivate(item.id)}
              aria-label={ariaLabel(item.name)}
              // `min-h-10` : la hauteur qu'un badge donne à une ligne de la
              // table ; sans, ces lignes seraient plus serrées que les siennes.
              className="flex min-h-10 w-full items-center py-2 pe-2 text-left font-medium wrap-break-word transition-colors duration-500 hover:bg-[var(--table-row-hover)]"
            >
              {/* Même étoile, même place que dans la table des attractions :
                  en ligne avec le nom, qu'elle suit s'il passe à la ligne. */}
              <span>
                {item.favorite && (
                  <Star
                    aria-label={tFav("myFavorites")}
                    className="mr-1 inline-block size-3.5 align-[-2px] fill-amber-400 text-amber-400"
                  />
                )}
                {item.name}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
