"use client";

import { AnimatePresence, motion } from "motion/react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import ParkCard from "./park-card";
import { ParkList } from "@/types/api";

interface ParkCategoryCardProps {
  groupName: string;
  parks: ParkList[];
}

// Ressort commun aux mouvements de la liste : doux et sans rebond marqué, pour
// que l'ajout/retrait d'un parc (« Masquer les parcs fermés ») et le
// redimensionnement de la carte glissent au lieu de sauter.
const SPRING = { type: "spring", stiffness: 320, damping: 36 } as const;

export default function ParkCategoryCard({
  groupName,
  parks,
}: ParkCategoryCardProps) {
  return (
    // `layout` : la carte change de hauteur en douceur quand des parcs entrent
    // ou sortent (filtre) et pousse/remonte fluidement ses voisines. Les variantes
    // initial/exit animent l'apparition/disparition d'une CATÉGORIE entière (une
    // catégorie qui se vide au filtre, ou le changement de tri groupe/pays).
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
                autres se repositionnent via `layout`. */}
            <AnimatePresence initial={false} mode="popLayout">
              {parks.map((park) => (
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
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
