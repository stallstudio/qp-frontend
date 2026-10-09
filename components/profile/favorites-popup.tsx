"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Loader2, Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFavorites } from "@/hooks/useFavorites";
import type { FavNamespace } from "@/lib/favorites-storage";
import type {
  ResolvedFavorites,
  ResolvedPoi,
} from "@/app/api/user/favorites/resolve/route";

// Le titre du popup de chaque namespace, dans `profile`. Une TABLE et non une
// clé fabriquée : `next-intl` exige des clés littérales.
const TITLE_KEYS: Record<FavNamespace, string> = {
  parks: "favoritesParksTitle",
  rides: "favoritesRidesTitle",
  shows: "favoritesShowsTitle",
  restaurants: "favoritesRestaurantsTitle",
  shops: "favoritesShopsTitle",
  hotels: "favoritesHotelsTitle",
  services: "favoritesServicesTitle",
};

const SPRING = { type: "spring", stiffness: 320, damping: 36 } as const;

// Une ligne « favori » : nom + étoile de retrait, centrée verticalement à droite.
// Le retrait déclenche la sortie animée (la ligne glisse à droite et se replie).
function FavoriteRow({
  name,
  removeLabel,
  onRemove,
}: {
  name: string;
  removeLabel: string;
  onRemove: () => void;
}) {
  return (
    <motion.li
      layout="position"
      exit={{ opacity: 0, height: 0, x: 32 }}
      transition={SPRING}
      className="overflow-hidden"
    >
      <div className="flex items-center gap-2 py-1.5">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{name}</p>
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="shrink-0 cursor-pointer rounded-full p-1.5 text-amber-400 transition-colors hover:bg-amber-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Star className="size-4 fill-current" />
        </button>
      </div>
    </motion.li>
  );
}

// Popup « Mes favoris », décliné par namespace (parcs, attractions, spectacles,
// restaurants…) selon `scope`, déclenché depuis la vignette correspondante du
// profil. Les clés (identifiants) sont résolues en noms à l'ouverture : tant que
// la résolution tourne, on affiche un rond de chargement plutôt que des
// identifiants bruts.
//
// Tout sauf les parcs : regroupé PAR PARC (en-tête de section) — plus lisible
// que le nom du parc répété sous chaque ligne. Cliquer l'étoile retire le favori (la
// ligne « part », les autres se réordonnent en douceur) ; un parc dont on retire
// la dernière attraction voit sa section disparaître. Hauteur bornée, défilement
// interne, scrollbar masquée.
export default function FavoritesPopup({
  scope,
  open,
  onOpenChange,
}: {
  scope: FavNamespace;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("profile");
  const { favorites: keys, toggle } = useFavorites(scope);

  // Noms résolus, quel que soit le namespace : un parc n'a pas de `parkName`.
  const [names, setNames] = useState<
    Map<string, { name: string; parkName?: string }>
  >(new Map());
  const [loading, setLoading] = useState(false);

  // Résolution des noms à l'ouverture (les clés ne stockent que des identifiants).
  useEffect(() => {
    if (!open) return;
    const list = [...keys];
    if (list.length === 0) {
      setNames(new Map());
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    axios
      .post<ResolvedFavorites>("/api/user/favorites/resolve", {
        [scope]: list,
      })
      .then(({ data }) => {
        if (cancelled) return;
        const resolved: { key: string; name: string; parkName?: string }[] =
          scope === "parks"
            ? data.parks
            : ((data[scope] ?? []) as ResolvedPoi[]);
        setNames(new Map(resolved.map((item) => [item.key, item])));
      })
      .catch(() => {
        // silencieux : on retombe sur l'affichage de la clé brute.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // On ne (re)résout qu'à l'ouverture ; les retraits se font en local ensuite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const title = t(TITLE_KEYS[scope]);
  const removeLabel = (name: string) => t("favoritesRemove", { name });

  // Parcs : liste plate triée par nom.
  const parkItems = [...keys]
    .map((key) => ({ key, name: names.get(key)?.name ?? key }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Tout le reste : regroupé par parc, parcs et éléments triés par nom.
  const groupedItems = (() => {
    const byPark = new Map<string, { key: string; name: string }[]>();
    for (const key of keys) {
      const resolved = names.get(key);
      const name = resolved?.name ?? key;
      const park = resolved?.parkName ?? "";
      const arr = byPark.get(park) ?? [];
      arr.push({ key, name });
      byPark.set(park, arr);
    }
    return [...byPark.entries()]
      .map(([park, items]) => ({
        park,
        items: items.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.park.localeCompare(b.park));
  })();

  const isEmpty = keys.size === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : isEmpty ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("favoritesListEmpty")}
          </p>
        ) : scope === "parks" ? (
          <ul className="max-h-[60vh] divide-y overflow-y-auto scrollbar-hide">
            <AnimatePresence initial={false}>
              {parkItems.map((item) => (
                <FavoriteRow
                  key={item.key}
                  name={item.name}
                  removeLabel={removeLabel(item.name)}
                  onRemove={() => toggle(item.key)}
                />
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto scrollbar-hide">
            <AnimatePresence initial={false}>
              {groupedItems.map((group) => (
                <motion.section
                  key={group.park}
                  layout
                  exit={{ opacity: 0, height: 0 }}
                  transition={SPRING}
                  className="overflow-hidden border-t border-border pt-2 first:border-t-0 first:pt-0"
                >
                  {/* En-tête de parc : bandeau discret collé au groupe, pour bien
                      séparer chaque parc sans gaspiller de hauteur. */}
                  <p className="sticky top-0 z-10 bg-background py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.park}
                  </p>
                  <ul className="divide-y">
                    <AnimatePresence initial={false}>
                      {group.items.map((item) => (
                        <FavoriteRow
                          key={item.key}
                          name={item.name}
                          removeLabel={removeLabel(item.name)}
                          onRemove={() => toggle(item.key)}
                        />
                      ))}
                    </AnimatePresence>
                  </ul>
                </motion.section>
              ))}
            </AnimatePresence>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
