"use client";

import { WaitTime, QueueTime } from "@/types/waitTime";
import { motion } from "motion/react";
import { getStatusBadge, getTimeSlotBadge, getWaitTimeBadge } from "@/lib/badge";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useWaitTimeChanges } from "@/hooks/useWaitTimeChanges";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { useFavorites } from "@/hooks/useFavorites";
import AttractionDetailDialog from "@/components/parks/attraction-detail/attraction-detail-dialog";
import { Link } from "@/i18n/routing";
import { rideSlug } from "@/lib/slug";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ChevronUp,
  ChevronDown,
  User,
  Clock,
  Eye,
  FastForward,
  CornerDownRight,
  Star,
} from "lucide-react";

type QueueTypeInfo = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const QUEUE_TYPE_MAP: Record<string, QueueTypeInfo> = {
  fastlane: {
    label: "Fastlane",
    icon: FastForward,
  },
  singlerider: {
    label: "Single Rider",
    icon: User,
  },
  virtualqueue: {
    label: "Virtual Queue",
    icon: Clock,
  },
};

type SortKey = "name" | "wait" | "status";
type SortDir = "asc" | "desc";

// Direction "naturelle" au premier clic sur une colonne.
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  name: "asc",
  wait: "desc",
  status: "asc",
};

type WaitTimeTableProps = {
  waitTimes: WaitTime[];
  queueTypeLabels?: Record<string, string> | null;
  parkIdentifier: string;
  parkName: string;
  // Lien profond `/park/{parc}/ride/{slug}` : attraction dont le popup doit
  // s'ouvrir dès l'arrivée sur la page.
  initialRideId?: number | null;
};

const STATUS_ORDER = { open: 0, down: 1, closed: 2, maintenance: 3 } as const;

// Grille partagée par l'en-tête et chaque ligne pour aligner les colonnes.
// Le cluster d'action (chevron d'expand + œil) est désormais collé À LA FIN DU
// NOM (dans la 1re colonne), donc plus de piste d'action dédiée : 3 colonnes.
// - mobile : Temps (4rem) et État (6rem, « Maintenance ») resserrés pour laisser
//   le MAXIMUM de largeur au nom ;
// - ≥ sm : proportions 4/1/1 comme l'ancienne table.
const GRID_COLS =
  "grid items-center grid-cols-[minmax(0,1fr)_4rem_6rem] sm:grid-cols-[minmax(0,4fr)_minmax(0,1fr)_minmax(0,1fr)]";

function getPrimaryQueue(wt: WaitTime): QueueTime | undefined {
  return wt.queues.find((q) => q.type === "standby") || wt.queues[0];
}

export default function ParkWaitTimeTable({
  waitTimes,
  queueTypeLabels,
  parkIdentifier,
  parkName,
  initialRideId = null,
}: WaitTimeTableProps) {
  const t = useTranslations("waitTimeTable");
  const tStatus = useTranslations("attractionStatus");
  const tDetail = useTranslations("attractionDetail");
  const tFav = useTranslations("favorites");
  const { is12Hour } = useTimeFormat();
  const [detailTarget, setDetailTarget] = useState<WaitTime | null>(null);
  const [expandedRides, setExpandedRides] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Les favoris ne sont plus (dé)marqués depuis la liste (ça passe par le popup)
  // mais restent épinglés en tête, d'où l'usage de `isFavorite` pour le tri.
  const { isFavorite } = useFavorites("rides");
  const favKey = (rideId: number) => `${parkIdentifier}:${rideId}`;

  const statusLabels: Record<string, string> = {
    open: tStatus("open"),
    closed: tStatus("closed"),
    down: tStatus("down"),
    maintenance: tStatus("maintenance"),
  };
  // « Indisponible » est le badge le plus large : version courte sur mobile
  // (« Indispo. ») pour qu'il rentre dans la colonne Temps, complète dès sm.
  const unavailableLabel = (
    <>
      <span className="sm:hidden">{tStatus("unavailableShort")}</span>
      <span className="hidden sm:inline">{tStatus("unavailable")}</span>
    </>
  );

  const changedRides = useWaitTimeChanges(waitTimes, 3000);

  // Lien profond : on ouvre le popup une seule fois, à l'arrivée. Sans ce garde,
  // le rafraîchissement 60 s (nouvelle référence de `waitTimes`) le rouvrirait
  // indéfiniment après chaque fermeture.
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current || initialRideId == null) return;
    const target = waitTimes.find((wt) => wt.rideId === initialRideId);
    // Attraction absente du flux du moment (fermée pour la saison, retirée par
    // le fournisseur) : on reste simplement sur la page du parc.
    if (target) setDetailTarget(target);
    deepLinkHandled.current = true;
  }, [initialRideId, waitTimes]);

  const getQueueLabel = (queueType: string): string => {
    if (queueTypeLabels && queueTypeLabels[queueType]) {
      return queueTypeLabels[queueType];
    }
    if (QUEUE_TYPE_MAP[queueType]) {
      return QUEUE_TYPE_MAP[queueType].label;
    }
    return queueType.charAt(0).toUpperCase() + queueType.slice(1);
  };

  const toggleExpand = (rideId: number) => {
    setExpandedRides((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rideId)) {
        newSet.delete(rideId);
      } else {
        newSet.add(rideId);
      }
      return newSet;
    });
  };

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key]);
    }
  };

  const sortedWaitTimes = useMemo(() => {
    const mult = sortDir === "asc" ? 1 : -1;

    return [...waitTimes].sort((a, b) => {
      // Favoris toujours épinglés en tête, quel que soit le tri.
      const aFav = isFavorite(favKey(a.rideId));
      const bFav = isFavorite(favKey(b.rideId));
      if (aFav !== bFav) return aFav ? -1 : 1;

      const aQueue = getPrimaryQueue(a);
      const bQueue = getPrimaryQueue(b);

      if (sortKey === "name") {
        return mult * a.rideName.localeCompare(b.rideName);
      }

      if (sortKey === "wait") {
        const aw = aQueue?.waitTime ?? -1;
        const bw = bQueue?.waitTime ?? -1;
        if (aw !== bw) return mult * (aw - bw);
        return a.rideName.localeCompare(b.rideName);
      }

      // status
      const as = aQueue ? STATUS_ORDER[aQueue.status] : 99;
      const bs = bQueue ? STATUS_ORDER[bQueue.status] : 99;
      if (as !== bs) return mult * (as - bs);
      const aw = aQueue?.waitTime ?? -1;
      const bw = bQueue?.waitTime ?? -1;
      if (aw !== bw) return bw - aw;
      return a.rideName.localeCompare(b.rideName);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitTimes, sortKey, sortDir, isFavorite]);

  const sortIndicator = (key: SortKey) => {
    if (key !== sortKey) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="size-3.5" />
    ) : (
      <ChevronDown className="size-3.5" />
    );
  };

  const sortButtonClass =
    "inline-flex items-center gap-1 cursor-pointer select-none hover:text-foreground transition-colors";

  // La liste n'est plus un `<table>` (les lignes sont des blocs animés), mais
  // elle en garde la SÉMANTIQUE via les rôles ARIA : sans eux, un lecteur
  // d'écran n'annoncerait qu'une suite de `<div>` sans en-têtes ni colonnes.
  const ariaSort = (key: SortKey) =>
    key === sortKey
      ? sortDir === "asc"
        ? ("ascending" as const)
        : ("descending" as const)
      : ("none" as const);

  // Signature de l'ordre courant : on ne (ré)anime le `layout` QUE quand cet
  // ordre change (reclassement réel). Ainsi, déplier une attraction ne déclenche
  // aucune animation de position (plus d'effet d'étirement à l'ouverture).
  const orderKey = sortedWaitTimes.map((w) => w.rideId).join(",");

  // Frontière entre les favoris (épinglés en tête) et les attractions
  // classiques : on encadre le groupe des favoris de deux séparateurs ondulés
  // ambrés (celui du haut porte le libellé « Vos favoris »).
  const favCount = sortedWaitTimes.filter((w) =>
    isFavorite(favKey(w.rideId)),
  ).length;
  const hasFavBoundary = favCount > 0 && favCount < sortedWaitTimes.length;

  return (
    <div className="w-full text-sm">
      <div role="table" aria-label={t("tableLabel", { park: parkName })}>
        {/* En-tête (colonnes triables) — hors zone animée. */}
        <div role="rowgroup">
          <div
            role="row"
            className={cn(
              GRID_COLS,
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
                {t("attraction")}
                {sortIndicator("name")}
              </button>
            </div>
            <div role="columnheader" aria-sort={ariaSort("wait")}>
              <button
                type="button"
                onClick={() => handleSort("wait")}
                className={sortButtonClass}
              >
                {t("waitTime")}
                {sortIndicator("wait")}
              </button>
            </div>
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

        {/* Corps : une ligne standby par attraction (+ files dépliées). Chaque
            attraction est un bloc `motion` animé en `layout` pour que le
            reclassement (tri, favoris épinglés, changements de temps) glisse au
            lieu de sauter. */}
        {sortedWaitTimes.map((waitTime, index) => {
          // Files triées : standby en premier, puis les autres par ordre alpha.
          const sortedQueues = [...waitTime.queues].sort((a, b) => {
            if (a.type === "standby") return -1;
            if (b.type === "standby") return 1;
            return a.type.localeCompare(b.type);
          });

          const standbyQueue = sortedQueues.find((q) => q.type === "standby");
          const otherQueues = sortedQueues.filter((q) => q.type !== "standby");
          const isExpanded = expandedRides.has(waitTime.rideId);
          const hasMultipleQueues = sortedQueues.length > 1;
          // Frontière favoris / reste : séparateur ondulé (sans libellé) inséré
          // avant la 1re attraction classique.
          const isBoundary = hasFavBoundary && index === favCount;

          return (
            <Fragment key={waitTime.rideId}>
              {/* Frontière basse des favoris : trait plein nettement plus épais
                  (3px) pour bien séparer les favoris des autres attractions.
                  Purement visuel -> retiré de l'arbre d'accessibilité, sans quoi
                  il casserait la structure `table > rowgroup > row`. */}
              {isBoundary && (
                <div role="presentation" className="border-t-[3px] border-border" />
              )}
              <motion.div
                role="rowgroup"
                layout="position"
                layoutDependency={orderKey}
                transition={{ type: "spring", stiffness: 320, damping: 36 }}
                // Séparateur entre attractions (pas de trait au niveau de la
                // frontière favoris, remplacé par le séparateur ondulé).
                className={cn(index > 0 && !isBoundary && "border-t")}
              >
                {/* Ligne standby (toujours affichée) */}
                {standbyQueue && (
                  <div
                    role="row"
                    className={cn(
                      GRID_COLS,
                      "group transition-colors duration-500",
                      changedRides.has(`${waitTime.rideId}-standby`) &&
                        "bg-accent",
                      hasMultipleQueues && "cursor-pointer hover:bg-accent/50",
                    )}
                    onClick={() =>
                      hasMultipleQueues && toggleExpand(waitTime.rideId)
                    }
                  >
                    {/* Nom + cluster d'action accolé À LA FIN DU NOM : chevron
                        d'expand (si files multiples) puis œil d'ouverture du
                        popup. Le nom peut passer à la ligne (min-w-0 + wrap), les
                        icônes restent sur la dernière ligne. */}
                    {/* pe resserré (surtout mobile) + cluster d'icônes collé au
                        nom : padding horizontal des boutons réduit (px-0.5) et
                        plus aucune marge/gap entre le nom et les icônes, pour que
                        le nom garde le MAXIMUM de largeur et passe moins vite à la
                        ligne. La hauteur de touche reste correcte (py-1). */}
                    {/* Rendu EN FLUX INLINE (pas de flex) : le nom coule et peut
                        passer sur plusieurs lignes ; le chevron et l'œil suivent
                        directement le dernier mot → ils restent COLLÉS À LA FIN DU
                        TEXTE, sur la dernière ligne, quel que soit le nombre de
                        lignes. Les icônes sont `inline-flex align-middle`. */}
                    {/* `rowheader` (et non `cell`) : le nom identifie la ligne,
                        ce qui permet aux lecteurs d'écran de le rappeler en
                        naviguant d'une colonne à l'autre. */}
                    <div
                      role="rowheader"
                      className="min-w-0 py-2 pe-1 font-medium sm:pe-2"
                    >
                      {/* Étoile jaune devant les favoris pour les repérer d'un
                          coup d'œil (les favoris sont épinglés en tête). */}
                      {isFavorite(favKey(waitTime.rideId)) && (
                        <Star
                          aria-label={tFav("myFavorites")}
                          className="mr-1 inline-block size-3.5 align-[-2px] fill-amber-400 text-amber-400"
                        />
                      )}
                      <span className="wrap-break-word">
                        {waitTime.rideName}
                      </span>
                      {hasMultipleQueues && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(waitTime.rideId);
                          }}
                          aria-expanded={isExpanded}
                          aria-label={t("toggleQueues", {
                            ride: waitTime.rideName,
                          })}
                          className="ml-1 inline-flex align-middle rounded-md text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <ChevronRight
                            className={cn(
                              "size-4 transition-transform duration-200",
                              isExpanded && "rotate-90",
                            )}
                          />
                        </button>
                      )}
                      {/* VRAI lien vers le lien profond de l'attraction,
                          neutralisé au clic simple pour ouvrir le popup
                          (l'expérience dans la liste ne change pas). L'intérêt
                          d'un `<a>` plutôt qu'un `<button>` : « copier l'adresse
                          du lien » permet de partager une attraction, et
                          Ctrl+clic / clic milieu ouvrent bien un nouvel onglet
                          qui arrive sur le parc avec ce popup ouvert. */}
                      <Link
                        href={`/park/${parkIdentifier}/ride/${rideSlug(
                          waitTime.rideId,
                          waitTime.rideName,
                        )}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          // Modificateurs enfoncés (nouvel onglet, nouvelle
                          // fenêtre) : on laisse le navigateur faire.
                          if (
                            e.metaKey ||
                            e.ctrlKey ||
                            e.shiftKey ||
                            e.altKey
                          ) {
                            return;
                          }
                          e.preventDefault();
                          setDetailTarget(waitTime);
                        }}
                        aria-label={tDetail("openFor", {
                          ride: waitTime.rideName,
                        })}
                        className="ml-1 inline-flex align-middle rounded-md text-muted-foreground transition-colors hover:text-primary"
                      >
                        <Eye className="size-3.5" />
                      </Link>
                    </div>
                    <div role="cell" className="py-2">
                      {standbyQueue.timeSlot
                        ? getTimeSlotBadge(standbyQueue.timeSlot, is12Hour)
                        : getWaitTimeBadge(
                            standbyQueue.waitTime,
                            unavailableLabel,
                          )}
                    </div>
                    <div
                      role="cell"
                      className="flex justify-end py-2 pe-0 sm:block"
                    >
                      {getStatusBadge(standbyQueue.status, statusLabels)}
                    </div>
                  </div>
                )}

                {/* Files secondaires (visibles seulement si dépliées) */}
                {isExpanded &&
                  otherQueues.map((queue) => (
                    <div
                      key={`${waitTime.rideId}-${queue.type}`}
                      role="row"
                      className={cn(
                        GRID_COLS,
                        "border-t transition-colors duration-500",
                        changedRides.has(`${waitTime.rideId}-${queue.type}`) &&
                          "bg-accent",
                      )}
                    >
                      <div
                        role="rowheader"
                        className="flex items-center gap-1 py-2 pe-2 ps-6 font-medium text-muted-foreground"
                      >
                        <CornerDownRight className="size-3.5" />
                        <span>{getQueueLabel(queue.type)}</span>
                        {QUEUE_TYPE_MAP[queue.type] &&
                          (() => {
                            const Icon = QUEUE_TYPE_MAP[queue.type].icon;
                            return <Icon className="size-3.5" />;
                          })()}
                      </div>
                      <div role="cell" className="py-2">
                        {queue.timeSlot
                          ? getTimeSlotBadge(queue.timeSlot, is12Hour)
                          : getWaitTimeBadge(queue.waitTime, unavailableLabel)}
                      </div>
                      <div
                        role="cell"
                        className="flex justify-end py-2 pe-0 sm:block"
                      >
                        {getStatusBadge(queue.status, statusLabels)}
                      </div>
                    </div>
                  ))}
              </motion.div>
            </Fragment>
          );
        })}
      </div>

      {/* Message d'absence de données : HORS du `role="table"`, qui n'accepte
          que des lignes. */}
      {sortedWaitTimes.length === 0 && (
        <div className="py-4 text-center text-muted-foreground">
          {t("noWaitTimes")}
        </div>
      )}

      {/* Popup « détail attraction », piloté par l'œil de chaque ligne. */}
      <AttractionDetailDialog
        target={detailTarget}
        parkIdentifier={parkIdentifier}
        parkName={parkName}
        onOpenChange={(open) => {
          if (!open) setDetailTarget(null);
        }}
      />
    </div>
  );
}
