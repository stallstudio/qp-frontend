"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import ParkCard from "./park-card";
import { getParkStatus } from "@/lib/utils";
import { ParkList } from "@/types/api";

// Ressort commun aux mouvements de la liste : doux et sans rebond marqué, pour
// que l'ajout/retrait d'un parc (« Masquer les parcs fermés ») et le
// redimensionnement de la carte glissent au lieu de sauter.
const SPRING = { type: "spring", stiffness: 320, damping: 36 } as const;

// Nombre de parcs affichés au repos par une catégorie repliable : au-delà, le
// reste passe derrière « Voir les N autres parcs ». Fantawild (49 parcs)
// écrasait sinon toute la colonne de l'accueil.
//
// ⚠️ QUELLES catégories sont repliables se décide dans `parks-list.tsx` (prop
// `collapsible`, liste en dur) — pas ici : la carte ne sait pas si on trie par
// groupe ou par pays.
export const CATEGORY_COLLAPSE_LIMIT = 10;

/**
 * Ordre d'affichage d'une catégorie repliable : parcs OUVERTS d'abord, chacun
 * des deux blocs restant alphabétique (la liste arrive déjà triée par nom et
 * `sort` est stable). Les places visibles vont ainsi aux parcs réellement
 * consultables maintenant, pas aux dix premiers de l'alphabet — dont la moitié
 * dort quand il fait nuit en Chine.
 *
 * ⚠️ Appliqué UNIQUEMENT aux catégories repliables : ailleurs l'ordre purement
 * alphabétique reste le plus lisible.
 */
function openFirst(parks: ParkList[]): ParkList[] {
  return [...parks].sort(
    (a, b) =>
      Number(getParkStatus(a.openingHours) !== "open") -
      Number(getParkStatus(b.openingHours) !== "open"),
  );
}

interface ParkCategoryCardProps {
  groupName: string;
  parks: ParkList[];
  /** Catégorie autorisée à se replier (décidé par `parks-list.tsx`). */
  collapsible?: boolean;
}

export default function ParkCategoryCard({
  groupName,
  parks,
  collapsible: allowCollapse = false,
}: ParkCategoryCardProps) {
  const t = useTranslations("parksList");
  const [showAll, setShowAll] = useState(false);

  const collapsible = allowCollapse && parks.length > CATEGORY_COLLAPSE_LIMIT;
  // L'ordre « ouverts d'abord » est conservé une fois déplié : sinon toute la
  // liste se réordonnerait sous le doigt au moment du clic.
  const ordered = collapsible ? openFirst(parks) : parks;
  const visibleParks =
    collapsible && !showAll ? ordered.slice(0, CATEGORY_COLLAPSE_LIMIT) : ordered;
  const remaining = parks.length - CATEGORY_COLLAPSE_LIMIT;

  return (
    // `layout` : la carte change de hauteur en douceur quand des parcs entrent
    // ou sortent (filtre, dépliage) et pousse/remonte fluidement ses voisines.
    // Les variantes initial/exit animent l'apparition/disparition d'une
    // CATÉGORIE entière (une catégorie qui se vide au filtre, ou le changement
    // de tri groupe/pays).
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={SPRING}
    >
      <Card className="p-0">
        <CardContent className="p-0">
          <CardTitle className="text-xl font-bold border-b px-4 py-2">
            {groupName}
          </CardTitle>
          <motion.div layout className="py-2 px-2 space-y-1">
            {/* Chaque parc entre/sort avec un fondu + repli de hauteur ; les
                autres se repositionnent via `layout`. C'est la MÊME animation
                qui sert au dépliage : les parcs cachés arrivent exactement comme
                ceux que le filtre fait revenir. */}
            <AnimatePresence initial={false} mode="popLayout">
              {visibleParks.map((park) => (
                <motion.div
                  key={park.identifier}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={SPRING}
                  className="overflow-hidden"
                >
                  <ParkCard park={park} />
                </motion.div>
              ))}
            </AnimatePresence>

            {collapsible && (
              <motion.button
                layout
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {showAll ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
                {showAll ? t("seeLess") : t("seeMoreParks", { count: remaining })}
              </motion.button>
            )}
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
