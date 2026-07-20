"use client";

import { useState } from "react";
import { ParkList } from "@/types/api";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import ParkCard from "../parks/park-card";
import { Card, CardContent } from "../ui/card";
import { useTranslations } from "next-intl";
import { useFavorites } from "@/hooks/useFavorites";

interface FavoriteParksProps {
  parks: ParkList[];
}

// Grille en 3 colonnes : 9 cartes = 3 lignes pleines. Au-delà, on n'affiche que
// 8 parcs + une tuile « Voir les N autres » (la 9e case) pour ne pas surcharger
// l'accueil. Le reste vit dans LA MÊME grille (alignement continu, pas de trou) :
// chaque carte révélée apparaît en fondu + léger glissé depuis le haut, avec un
// petit décalage en cascade → l'ensemble « se déroule » vers le bas, et se replie
// vers le haut en sortie.
const FULL_ROWS = 9;
const COLLAPSED_VISIBLE = 8;

function ParkCell({ park }: { park: ParkList }) {
  return (
    <Card className="p-0">
      <CardContent className="p-0 h-full">
        <ParkCard park={park} showBadge={false} />
      </CardContent>
    </Card>
  );
}

export default function FavoriteParks({ parks }: FavoriteParksProps) {
  const t = useTranslations("favorites");
  const { favorites, isReady } = useFavorites("parks");
  const [showAll, setShowAll] = useState(false);
  // La tuile « Voir plus » ne doit RÉAPPARAÎTRE qu'une fois les extras entièrement
  // sortis (sinon elle surgit tout en bas puis remonte d'un coup). `extrasSettled`
  // passe à true via `onExitComplete` de la présence des extras.
  const [extrasSettled, setExtrasSettled] = useState(true);

  const expand = () => {
    setExtrasSettled(false);
    setShowAll(true);
  };
  const collapse = () => setShowAll(false);

  // Avant hydratation on ne rend rien (favorites vide) : pas de flash de section.
  if (!isReady || favorites.size === 0) {
    return null;
  }

  const favoriteParks = parks.filter((park) => favorites.has(park.identifier));

  if (favoriteParks.length === 0) {
    return null;
  }

  const canCollapse = favoriteParks.length > FULL_ROWS;
  const collapsed = canCollapse && !showAll;
  // Base toujours visible : 8 cartes si repliable, sinon tout. Les cartes au-delà
  // de la 8e sont les « extras » révélés (la 1re prend la place du bouton).
  const baseParks = canCollapse
    ? favoriteParks.slice(0, COLLAPSED_VISIBLE)
    : favoriteParks;
  const extraParks = canCollapse ? favoriteParks.slice(COLLAPSED_VISIBLE) : [];
  const remaining = extraParks.length;

  // Cartes révélées : entrée en cascade du HAUT vers le bas (delay croissant),
  // sortie en cascade du BAS vers le haut (delay inversé) — au repli, ça
  // « remonte » depuis la dernière carte. `custom` = index de la carte.
  const EASE = [0.32, 0.72, 0, 1] as const;
  const STEP = 0.03;
  const revealVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.26, ease: EASE, delay: Math.min(i, 8) * STEP },
    }),
    exit: (i: number) => ({
      opacity: 0,
      y: -10,
      transition: {
        duration: 0.22,
        ease: EASE,
        delay: Math.min(remaining - 1 - i, 8) * STEP,
      },
    }),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-3xl font-bold">{t("myFavorites")}</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {baseParks.map((park) => (
          <ParkCell key={park.identifier} park={park} />
        ))}

        {/* Cartes révélées : entrée cascade du haut, sortie cascade du bas.
            `onExitComplete` marque la fin de la sortie → la tuile « Voir plus »
            peut réapparaître (à sa vraie place, en douceur). */}
        <AnimatePresence
          initial={false}
          onExitComplete={() => setExtrasSettled(true)}
        >
          {showAll &&
            extraParks.map((park, i) => (
              <motion.div
                key={park.identifier}
                custom={i}
                variants={revealVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <ParkCell park={park} />
              </motion.div>
            ))}
        </AnimatePresence>

        {/* 9e case (repliée) : déplier le reste. N'apparaît qu'une fois les extras
            entièrement sortis (`extrasSettled`), en fondu. */}
        <AnimatePresence initial={false}>
          {collapsed && extrasSettled && (
            <motion.div
              key="more-btn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
            >
              <Card className="p-0 h-full">
                <CardContent className="p-0 h-full">
                  <button
                    type="button"
                    onClick={expand}
                    className="flex h-full w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <ChevronDown className="size-4" />
                    {t("seeMore", { count: remaining })}
                  </button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Une fois déplié : bouton pour replier. */}
      {showAll && canCollapse && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={collapse}
            className="flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronUp className="size-4" />
            {t("seeLess")}
          </button>
        </div>
      )}
    </div>
  );
}
