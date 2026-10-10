"use client";

import { motion } from "motion/react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { BellRing, ChevronDown, ChevronUp, Star } from "lucide-react";
import { getStatusBadge, getWaitTimeBadge } from "@/lib/badge";
import { useWaitTimeChanges } from "@/hooks/useWaitTimeChanges";
import { useFavoritesContext } from "@/components/providers/favorites-provider";
import { useNotifications } from "@/components/providers/notifications-provider";
import { poiFavorite } from "@/lib/favorites-storage";
import { STATUS_ORDER, getPrimaryQueue, splitGluedTail } from "@/lib/poi-list";
import { showsWaitTime, type PoiCardKind } from "@/lib/poi-kinds";
import PoiDetailDialog from "@/components/parks/poi-detail/poi-detail-dialog";
import EventExtrasList from "@/components/parks/event-extras-list";
import { cn } from "@/lib/utils";
import type { WaitTime } from "@/types/waitTime";

type SortKey = "name" | "status";
type SortDir = "asc" | "desc";

// Direction « naturelle » au premier clic sur une colonne.
const DEFAULT_DIR: Record<SortKey, SortDir> = { name: "asc", status: "asc" };

type PoiStatusTableProps = {
  pois: WaitTime[];
  /**
   * POI SANS état publié mais avec quelque chose à montrer dans le popup — les
   * restaurants à carte du Parc Astérix (`lib/menu-pois.ts`). Listés sous la
   * table, comme les attractions sans temps d'une carte d'événement.
   */
  unlisted?: WaitTime[];
  kind: PoiCardKind;
  parkIdentifier: string;
  parkName: string;
  // Le parc laisse-t-il encore le temps à une alerte de réouverture de servir ?
  // Simplement transmis au popup, comme pour les attractions.
  reopenAllowed?: boolean;
  // Lien profond `/park/{parc}/ride/{slug}` vers un POI de cette liste (la
  // notification d'une alerte de restaurant) : son popup s'ouvre à l'arrivée.
  initialPoiId?: number | null;
};

/**
 * Liste d'état des POI qui ne sont pas des attractions — restaurants,
 * boutiques, hôtels, services.
 *
 * ⚠️ **Un composant à part, et non un mode de `wait-time-table.tsx`.** Ce
 * dernier porte le dépliage des files secondaires, leurs popups et le tri par
 * temps d'attente — des mécanismes qui n'ont aucun sens sur un témoin
 * ouvert/fermé. Le paramétrer, ce serait les désactiver depuis l'appelant, et
 * rendre chacune de ses évolutions futures conditionnelle.
 *
 * Ce qui est partagé l'est vraiment : `STATUS_ORDER` et `splitGluedTail`
 * (`lib/poi-list.ts`), les pastilles de `lib/badge.tsx`, et `useWaitTimeChanges`
 * pour le clignotement au changement d'état. Et depuis le 2026-10-09, les
 * FAVORIS — étoile devant le nom, épinglés en tête, trait épais sous le
 * dernier —, la cloche d'une alerte active et le lien profond, avec les mêmes
 * repères que la liste des attractions.
 *
 * ⚠️ **Deux colonnes, pas trois, sauf déclaration explicite.** Ce que ces
 * sources publient est un état, pas une file : chez Compagnie des Alpes un
 * restaurant ouvert annonce une constante (5 min à Bellewaerde) et `-1` fermé.
 * La colonne « temps » ne s'ouvre que pour les parcs listés dans
 * `REAL_WAIT_TIMES` (`lib/poi-kinds.ts`).
 */
export default function PoiStatusTable({
  pois,
  unlisted = [],
  kind,
  parkIdentifier,
  parkName,
  reopenAllowed = true,
  initialPoiId = null,
}: PoiStatusTableProps) {
  const t = useTranslations("waitTimeTable");
  const tStatus = useTranslations("attractionStatus");
  const tFav = useTranslations("favorites");
  const tDetail = useTranslations("attractionDetail");
  // Le (dé)favori se fait depuis le popup ; la liste ne fait que les épingler.
  const { favorites } = useFavoritesContext();
  const isFavorite = (poi: WaitTime) => {
    const { namespace, key } = poiFavorite(parkIdentifier, {
      id: poi.rideId,
      name: poi.rideName,
      kind: poi.kind,
    });
    return favorites[namespace].has(key);
  };
  // Une alerte n'existe que sur un POI qui publie son attente (voir le popup).
  const { alertRideIds } = useNotifications();
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

  // Lien profond : ouvert une seule fois, à l'arrivée — même garde que dans la
  // liste des attractions, sans quoi chaque rafraîchissement le rouvrirait.
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current || initialPoiId == null) return;
    if (
      pois.some((poi) => poi.rideId === initialPoiId) ||
      unlisted.some((poi) => poi.rideId === initialPoiId)
    ) {
      setDetailPoiId(initialPoiId);
    }
    deepLinkHandled.current = true;
  }, [initialPoiId, pois, unlisted]);

  // Données VIVES du POI ouvert dans le popup, relues à chaque rafraîchissement
  // — même raison que dans le tableau des attractions : garder l'OBJET du clic
  // en ferait une photo que le cycle de 60 s ne mettrait jamais à jour.
  const detailTarget =
    detailPoiId != null
      ? (pois.find((poi) => poi.rideId === detailPoiId) ??
        unlisted.find((poi) => poi.rideId === detailPoiId) ??
        null)
      : null;

  const sorted = useMemo(() => {
    const mult = sortDir === "asc" ? 1 : -1;
    return [...pois].sort((a, b) => {
      // Favoris toujours épinglés en tête, quel que soit le tri.
      const aFav = isFavorite(a);
      const bFav = isFavorite(b);
      if (aFav !== bFav) return aFav ? -1 : 1;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pois, sortKey, sortDir, favorites, parkIdentifier]);

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

  // Frontière entre les favoris épinglés et le reste : même trait épais que
  // dans la liste des attractions.
  const favCount = sorted.filter(isFavorite).length;
  const hasFavBoundary = favCount > 0 && favCount < sorted.length;

  return (
    <div className="w-full text-sm">
      {/* Même sémantique ARIA que le tableau des attractions : les lignes sont
          des blocs animés, pas un `<table>`, et sans ces rôles un lecteur
          d'écran n'annoncerait qu'une suite de `<div>`.
          Rien d'état publié, mais des POI sans état : pas de table du tout,
          dont l'en-tête surmonterait une liste vide. */}
      {pois.length > 0 && (
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
            const isBoundary = hasFavBoundary && index === favCount;

            return (
              <Fragment key={poi.rideId}>
                {/* Purement visuel : hors de l'arbre d'accessibilité, sans quoi
                    il casserait la structure `table > rowgroup > row`. */}
                {isBoundary && (
                  <div role="presentation" className="border-t-[3px] border-border" />
                )}
                <motion.div
                  role="rowgroup"
                  layout="position"
                  layoutDependency={orderKey}
                  transition={{ type: "spring", stiffness: 320, damping: 36 }}
                  className={cn(index > 0 && !isBoundary && "border-t")}
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
                      {isFavorite(poi) && (
                        <Star
                          aria-label={tFav("myFavorites")}
                          className="mr-1 inline-block size-3.5 align-[-2px] fill-amber-400 text-amber-400"
                        />
                      )}
                      <span className="wrap-break-word">{head}</span>
                      {/* Dernier mot + cloche : bloc insécable, comme dans la
                          liste des attractions. */}
                      <span className="whitespace-nowrap">
                        {tail}
                        {alertRideIds.has(poi.rideId) && (
                          <BellRing
                            aria-label={tDetail("notifActive")}
                            className="ms-1.5 inline-block size-3.5 align-[-2px] text-primary"
                          />
                        )}
                      </span>
                    </div>
                    {withWaitTime && (
                      <div role="cell" className="py-2">
                        {getWaitTimeBadge(
                          queue.waitTime,
                          unavailableLabel,
                          undefined,
                          queue.waitRange,
                        )}
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
      )}

      {/* ⚠️ Pas de ligne dans la table : un état « – » se lirait comme
          « fermé », alors qu'on ne sait simplement pas. */}
      {unlisted.length > 0 && (
        <EventExtrasList
          items={unlisted.map((poi) => ({
            id: poi.rideId,
            name: poi.rideName,
            favorite: isFavorite(poi),
          }))}
          heading={pois.length > 0 ? t("unlistedStatusTitle") : null}
          ariaLabel={(poi) => tDetail("openFor", { ride: poi })}
          onActivate={(id) => setDetailPoiId(id)}
        />
      )}

      <PoiDetailDialog
        target={detailTarget}
        parkIdentifier={parkIdentifier}
        parkName={parkName}
        reopenAllowed={reopenAllowed}
        onOpenChange={(open) => {
          if (!open) setDetailPoiId(null);
        }}
      />
    </div>
  );
}
