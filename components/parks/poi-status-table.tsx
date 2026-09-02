"use client";

import { motion } from "motion/react";
import { Fragment, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp } from "lucide-react";
import { getStatusBadge, getWaitTimeBadge } from "@/lib/badge";
import { useWaitTimeChanges } from "@/hooks/useWaitTimeChanges";
import { STATUS_ORDER, getPrimaryQueue, splitGluedTail } from "@/lib/poi-list";
import { showsWaitTime, type PoiCardKind } from "@/lib/poi-kinds";
import PoiDetailDialog from "@/components/parks/poi-detail/poi-detail-dialog";
import { cn } from "@/lib/utils";
import type { WaitTime } from "@/types/waitTime";

type SortKey = "name" | "status";
type SortDir = "asc" | "desc";

// Direction « naturelle » au premier clic sur une colonne.
const DEFAULT_DIR: Record<SortKey, SortDir> = { name: "asc", status: "asc" };

type PoiStatusTableProps = {
  pois: WaitTime[];
  kind: PoiCardKind;
  parkIdentifier: string;
  parkName: string;
};

/**
 * Liste d'état des POI qui ne sont pas des attractions — restaurants,
 * boutiques, hôtels, services.
 *
 * ⚠️ **Un composant à part, et non un mode de `wait-time-table.tsx`.** Ce
 * dernier porte les favoris, les alertes, le dépliage des files secondaires, le
 * lien profond `/ride/{slug}`, l'épinglage des favoris en tête et l'animation de
 * reclassement — six mécanismes dont AUCUN n'a de sens sur un témoin
 * ouvert/fermé. Le paramétrer, ce serait en désactiver la moitié depuis
 * l'appelant, et rendre chacune de ses évolutions futures conditionnelle.
 *
 * Ce qui est partagé l'est vraiment : `STATUS_ORDER` et `splitGluedTail`
 * (`lib/poi-list.ts`), les pastilles de `lib/badge.tsx`, et `useWaitTimeChanges`
 * pour le clignotement au changement d'état.
 *
 * ⚠️ **Deux colonnes, pas trois, sauf déclaration explicite.** Ce que ces
 * sources publient est un état, pas une file : chez Compagnie des Alpes un
 * restaurant ouvert annonce une constante (5 min à Bellewaerde) et `-1` fermé.
 * La colonne « temps » ne s'ouvre que pour les parcs listés dans
 * `REAL_WAIT_TIMES` (`lib/poi-kinds.ts`), aujourd'hui aucun.
 */
export default function PoiStatusTable({
  pois,
  kind,
  parkIdentifier,
  parkName,
}: PoiStatusTableProps) {
  const t = useTranslations("waitTimeTable");
  const tStatus = useTranslations("attractionStatus");
  const [detailPoiId, setDetailPoiId] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const withWaitTime = showsWaitTime(parkIdentifier, kind);

  // Même grille que `wait-time-table.tsx` à une colonne près : sans la colonne
  // « temps », le nom récupère ses 4rem plutôt que de laisser un vide.
  const gridCols = withWaitTime
    ? "grid items-center gap-x-2 grid-cols-[minmax(0,1fr)_4rem_6rem] sm:grid-cols-[minmax(0,4fr)_minmax(0,1fr)_minmax(0,1fr)]"
    : "grid items-center gap-x-2 grid-cols-[minmax(0,1fr)_6rem] sm:grid-cols-[minmax(0,4fr)_minmax(0,1fr)]";

  const statusLabels: Record<string, string> = {
    open: tStatus("open"),
    closed: tStatus("closed"),
    down: tStatus("down"),
    maintenance: tStatus("maintenance"),
  };
  const unavailableLabel = (
    <>
      <span className="sm:hidden">{tStatus("unavailableShort")}</span>
      <span className="hidden sm:inline">{tStatus("unavailable")}</span>
    </>
  );

  const changed = useWaitTimeChanges(pois, 3000);

  // Données VIVES du POI ouvert dans le popup, relues à chaque rafraîchissement
  // — même raison que dans le tableau des attractions : garder l'OBJET du clic
  // en ferait une photo que le cycle de 60 s ne mettrait jamais à jour.
  const detailTarget =
    detailPoiId != null
      ? (pois.find((poi) => poi.rideId === detailPoiId) ?? null)
      : null;

  const sorted = useMemo(() => {
    const mult = sortDir === "asc" ? 1 : -1;
    return [...pois].sort((a, b) => {
      if (sortKey === "name") {
        return mult * a.rideName.localeCompare(b.rideName);
      }
      const as = getPrimaryQueue(a)?.status;
      const bs = getPrimaryQueue(b)?.status;
      const ao = as ? STATUS_ORDER[as] : 99;
      const bo = bs ? STATUS_ORDER[bs] : 99;
      if (ao !== bo) return mult * (ao - bo);
      return a.rideName.localeCompare(b.rideName);
    });
  }, [pois, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key]);
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (key !== sortKey) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="size-3.5" />
    ) : (
      <ChevronDown className="size-3.5" />
    );
  };

  const ariaSort = (key: SortKey) =>
    key === sortKey
      ? sortDir === "asc"
        ? ("ascending" as const)
        : ("descending" as const)
      : ("none" as const);

  const sortButtonClass =
    "inline-flex items-center gap-1 cursor-pointer select-none hover:text-foreground transition-colors";

  // Signature de l'ordre courant : le `layout` ne se rejoue que sur un
  // reclassement réel, jamais sur un simple re-rendu.
  const orderKey = sorted.map((poi) => poi.rideId).join(",");

  return (
    <div className="w-full text-sm">
      {/* Même sémantique ARIA que le tableau des attractions : les lignes sont
          des blocs animés, pas un `<table>`, et sans ces rôles un lecteur
          d'écran n'annoncerait qu'une suite de `<div>`. */}
      <div role="table" aria-label={t("tableLabel", { park: parkName })}>
        <div role="rowgroup">
          <div
            role="row"
            className={cn(
              gridCols,
              "h-10 border-b font-medium text-muted-foreground",
            )}
          >
            <div
              role="columnheader"
              aria-sort={ariaSort("name")}
              className="justify-self-start"
            >
              <button
                type="button"
                onClick={() => handleSort("name")}
                className={sortButtonClass}
              >
                {t("name")}
                {sortIndicator("name")}
              </button>
            </div>
            {withWaitTime && (
              <div role="columnheader" aria-sort="none">
                {t("waitTime")}
              </div>
            )}
            <div
              role="columnheader"
              aria-sort={ariaSort("status")}
              className="justify-self-end sm:justify-self-start"
            >
              <button
                type="button"
                onClick={() => handleSort("status")}
                className={cn(sortButtonClass, "pe-0")}
              >
                {t("status")}
                {sortIndicator("status")}
              </button>
            </div>
          </div>
        </div>

        {sorted.map((poi, index) => {
          const queue = getPrimaryQueue(poi);
          if (!queue) return null;
          const { head, tail } = splitGluedTail(poi.rideName);

          return (
            <Fragment key={poi.rideId}>
              <motion.div
                role="rowgroup"
                layout="position"
                layoutDependency={orderKey}
                transition={{ type: "spring", stiffness: 320, damping: 36 }}
                className={cn(index > 0 && "border-t")}
              >
                <div
                  role="row"
                  className={cn(
                    gridCols,
                    "cursor-pointer transition-colors duration-500",
                    // Mêmes rôles que la table des temps d'attente : la teinte
                    // suit la carte d'événement quand il y en a une.
                    "hover:bg-[var(--table-row-hover)]",
                    changed.has(`${poi.rideId}-${queue.type}`) &&
                      "bg-[var(--table-row-accent)]",
                  )}
                  onClick={() => setDetailPoiId(poi.rideId)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    setDetailPoiId(poi.rideId);
                  }}
                >
                  <div
                    role="rowheader"
                    className="min-w-0 py-2 pe-1 font-medium sm:pe-2"
                  >
                    <span className="wrap-break-word">{head}</span>
                    <span className="whitespace-nowrap">{tail}</span>
                  </div>
                  {withWaitTime && (
                    <div role="cell" className="py-2">
                      {getWaitTimeBadge(queue.waitTime, unavailableLabel)}
                    </div>
                  )}
                  <div
                    role="cell"
                    className="flex justify-end py-2 pe-0 sm:block"
                  >
                    {getStatusBadge(queue.status, statusLabels, true)}
                  </div>
                </div>
              </motion.div>
            </Fragment>
          );
        })}
      </div>

      <PoiDetailDialog
        target={detailTarget}
        parkName={parkName}
        onOpenChange={(open) => {
          if (!open) setDetailPoiId(null);
        }}
      />
    </div>
  );
}
