"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type FavoriteStarProps = {
  active: boolean;
  onToggle: () => void;
  label: string;
  className?: string;
  size?: "sm" | "md";
};

/**
 * Bouton étoile pour (dé)marquer un favori. Neutre au repos, ambre une fois actif.
 *
 * Rendu comme `span[role=button]` (et non `<button>`) pour rester du HTML valide
 * même imbriqué dans un `<Link>`/`<a>` (cartes de parc), tout en restant
 * accessible au clavier (Entrée / Espace).
 */
export default function FavoriteStar({
  active,
  onToggle,
  label,
  className,
  size = "sm",
}: FavoriteStarProps) {
  const iconSize = size === "sm" ? "size-4" : "size-5";

  const activate = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // Next.js hydrate sur `document`, donc React délègue ses events là où
    // nextjs-toploader écoute aussi. stopPropagation ne suffit pas (même
    // élément) : sans ceci, le top-loader démarre et reste bloqué puisqu'on
    // annule la navigation. stopImmediatePropagation coupe l'autre listener.
    e.nativeEvent.stopImmediatePropagation();
    onToggle();
  };

  return (
    <span
      role="button"
      tabIndex={0}
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          activate(e);
        }
      }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full p-0.5 cursor-pointer transition-colors",
        active
          ? "text-amber-400 hover:text-amber-500"
          : "text-muted-foreground/40 hover:text-muted-foreground",
        className,
      )}
    >
      <Star className={cn(iconSize, active && "fill-current")} />
    </span>
  );
}
