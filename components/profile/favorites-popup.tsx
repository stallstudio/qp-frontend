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
import type {
  ResolvedPark,
  ResolvedRide,
} from "@/app/api/user/favorites/resolve/route";

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
      <div className="flex items-center gap-3 py-3">
        <p className="min-w-0 flex-1 truncate font-medium">{name}</p>
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="shrink-0 cursor-pointer rounded-full p-1.5 text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Star className="size-5 fill-current" />
        </button>
      </div>
    </motion.li>
  );
}

// Popup « Mes favoris », décliné par type (parcs OU attractions) selon `scope`,
// déclenché depuis la vignette correspondante du profil. Les clés (identifiants)
// sont résolues en noms à l'ouverture : tant que la résolution tourne, on affiche
// un rond de chargement plutôt que des identifiants bruts.
//
// Attractions : regroupées PAR PARC (en-tête de section) — plus lisible que le
// nom du parc répété sous chaque ligne. Cliquer l'étoile retire le favori (la
// ligne « part », les autres se réordonnent en douceur) ; un parc dont on retire
// la dernière attraction voit sa section disparaître. Hauteur bornée, défilement
// interne, scrollbar masquée.
export default function FavoritesPopup({
  scope,
  open,
  onOpenChange,
}: {
  scope: "parks" | "rides";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("profile");
  const { favorites: keys, toggle } = useFavorites(scope);

  const [rideNames, setRideNames] = useState<Map<string, ResolvedRide>>(new Map());
  const [parkNames, setParkNames] = useState<Map<string, ResolvedPark>>(new Map());
  const [loading, setLoading] = useState(false);

  // Résolution des noms à l'ouverture (les clés ne stockent que des identifiants).
  useEffect(() => {
    if (!open) return;
    const list = [...keys];
    if (list.length === 0) {
      setRideNames(new Map());
      setParkNames(new Map());
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const payload =
      scope === "rides" ? { rides: list, parks: [] } : { parks: list, rides: [] };
    axios
      .post<{ parks: ResolvedPark[]; rides: ResolvedRide[] }>(
        "/api/user/favorites/resolve",
        payload,
      )
      .then(({ data }) => {
        if (cancelled) return;
        setRideNames(new Map(data.rides.map((r) => [r.key, r])));
        setParkNames(new Map(data.parks.map((p) => [p.key, p])));
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

  const title =
    scope === "rides" ? t("favoritesRidesTitle") : t("favoritesParksTitle");
  const removeLabel = (name: string) => t("favoritesRemove", { name });

  // Parcs : liste plate triée par nom.
  const parkItems = [...keys]
    .map((key) => ({ key, name: parkNames.get(key)?.name ?? key }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Attractions : regroupées par parc, parcs et attractions triés par nom.
  const rideGroups = (() => {
    const byPark = new Map<string, { key: string; name: string }[]>();
    for (const key of keys) {
      const r = rideNames.get(key);
      const park = r?.parkName ?? "";
      const arr = byPark.get(park) ?? [];
      arr.push({ key, name: r?.rideName ?? key });
      byPark.set(park, arr);
    }
    return [...byPark.entries()]
      .map(([park, rides]) => ({
        park,
        rides: rides.sort((a, b) => a.name.localeCompare(b.name)),
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
              {rideGroups.map((group) => (
                <motion.section
                  key={group.park}
                  layout
                  exit={{ opacity: 0, height: 0 }}
                  transition={SPRING}
                  className="overflow-hidden border-t border-border pt-3 first:border-t-0 first:pt-0"
                >
                  {/* En-tête de parc : bandeau discret + trait, pour bien séparer
                      visuellement chaque parc (les groupes ne se mélangent plus). */}
                  <p className="sticky top-0 z-10 mb-1 bg-background pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.park}
                  </p>
                  <ul className="divide-y">
                    <AnimatePresence initial={false}>
                      {group.rides.map((ride) => (
                        <FavoriteRow
                          key={ride.key}
                          name={ride.name}
                          removeLabel={removeLabel(ride.name)}
                          onRemove={() => toggle(ride.key)}
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
