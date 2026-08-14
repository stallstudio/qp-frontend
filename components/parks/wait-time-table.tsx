"use client";

import { WaitTime, QueueTime } from "@/types/waitTime";
import { motion } from "motion/react";
import { getStatusBadge, getTimeSlotBadge, getWaitTimeBadge } from "@/lib/badge";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useWaitTimeChanges } from "@/hooks/useWaitTimeChanges";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { useFavorites } from "@/hooks/useFavorites";
import { useNotifications } from "@/components/providers/notifications-provider";
import AttractionDetailDialog from "@/components/parks/attraction-detail/attraction-detail-dialog";
import { cn } from "@/lib/utils";
import {
  BellRing,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  User,
  Clock,
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

// Au-delà de cette longueur, le dernier mot n'est plus collé aux icônes (voir
// `splitGluedTail`).
const MAX_GLUED_TAIL = 18;

/**
 * Découpe un libellé en « début » + « dernier mot ».
 *
 * Le dernier mot est ensuite rendu dans le même bloc `whitespace-nowrap` que les
 * icônes qui le suivent (chevron, cloche, type de file). Sans ça, sur mobile,
 * ces icônes se retrouvent SEULES sur une ligne, sans texte — un rendu qui
 * n'évoque rien. Quand la place manque, c'est donc le dernier mot qui part à la
 * ligne AVEC elles : « Voltron Nevera powered by » / « Rimac ⌄ 🔔 ».
 *
 * Garde-fou : un dernier mot très long resterait insécable et déborderait de la
 * colonne (étroite sur mobile). Au-delà de `MAX_GLUED_TAIL` caractères on
 * repasse donc au flux normal ; seules les icônes restent solidaires entre
 * elles.
 *
 * Partagé par la ligne standby et les lignes de files secondaires : ces
 * dernières étaient en `flex items-center`, si bien qu'un libellé sur deux
 * lignes laissait son icône centrée verticalement à côté du bloc, détachée.
 */
function splitGluedTail(name: string): { head: string; tail: string } {
  const lastSpace = name.lastIndexOf(" ");
  const candidate = name.slice(lastSpace + 1);
  if (candidate.length > MAX_GLUED_TAIL) return { head: name, tail: "" };
  return { head: name.slice(0, lastSpace + 1), tail: candidate };
}

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
  // Le parc laisse-t-il encore le temps à une alerte de réouverture de servir ?
  // Calculé depuis ses horaires par la carte parente, simplement transmis au
  // popup. Non fourni = on autorise.
  reopenAllowed?: boolean;
  // Lien profond `/park/{parc}/ride/{slug}` : attraction dont le popup doit
  // s'ouvrir dès l'arrivée sur la page.
  initialRideId?: number | null;
};

const STATUS_ORDER = { open: 0, down: 1, closed: 2, maintenance: 3 } as const;

// Grille partagée par l'en-tête et chaque ligne pour aligner les colonnes.
// Le chevron d'expand est collé À LA FIN DU NOM (dans la 1re colonne), donc pas
// de piste d'action dédiée : 3 colonnes.
// - mobile : Temps (4rem) et État (6rem, « Maintenance ») resserrés pour laisser
//   le MAXIMUM de largeur au nom ;
// - ≥ sm : proportions 4/1/1 comme l'ancienne table.
//
// ⚠️ `gap-x-2` : sans gouttière, « Indispo » et « Maintenance » se TOUCHAIENT
// sur mobile, et les deux pastilles se lisaient comme une seule. Le cas n'est
// pas anodin — ce sont les deux libellés les plus longs de leurs colonnes
// respectives, donc chacun occupe la sienne entièrement : « Indispo » finit à
// 4 px du bord de ses 4rem, « Maintenance » commence pile au début de ses 6rem
// (la cellule est en `justify-end`, la pastille remplit tout).
// La gouttière coûte 8 px au nom sur mobile ; la pastille d'état en rend
// autant (voir son `px-1.5 sm:px-2` dans `lib/badge.tsx`), d'où un écart
// visible d'une quinzaine de pixels pour une largeur de nom inchangée.
const GRID_COLS =
  "grid items-center gap-x-2 grid-cols-[minmax(0,1fr)_4rem_6rem] sm:grid-cols-[minmax(0,4fr)_minmax(0,1fr)_minmax(0,1fr)]";

function getPrimaryQueue(wt: WaitTime): QueueTime | undefined {
  return wt.queues.find((q) => q.type === "standby") || wt.queues[0];
}

export default function ParkWaitTimeTable({
  waitTimes,
  queueTypeLabels,
  parkIdentifier,
  parkName,
  reopenAllowed = true,
  initialRideId = null,
}: WaitTimeTableProps) {
  const t = useTranslations("waitTimeTable");
  const tStatus = useTranslations("attractionStatus");
  const tDetail = useTranslations("attractionDetail");
  const tFav = useTranslations("favorites");
  const { is12Hour } = useTimeFormat();
  // Popup « détail » : on retient l'IDENTIFIANT de l'attraction, pas son objet.
  //
  // ⚠️ Stocker l'objet en faisait une PHOTO prise au clic, que le
  // rafraîchissement 60 s ne mettait jamais à jour. Le popup pouvait donc
  // afficher « En panne » alors que l'attraction avait rouvert entre-temps — et
  // surtout proposer l'alerte correspondant à cet état périmé (voir
  // `AlertSection` : la nature de l'alerte se déduit du statut). En repartant de
  // l'identifiant, le contenu du popup suit le direct, y compris le formulaire
  // d'alerte qui bascule tout seul de « réouverture » à « seuil ».
  const [detailRideId, setDetailRideId] = useState<number | null>(null);
  const [expandedRides, setExpandedRides] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Les favoris ne sont plus (dé)marqués depuis la liste (ça passe par le popup)
  // mais restent épinglés en tête, d'où l'usage de `isFavorite` pour le tri.
  const { isFavorite } = useFavorites("rides");
  const favKey = (rideId: number) => `${parkIdentifier}:${rideId}`;

  // Attractions sous alerte de temps d'attente : une cloche les signale dans la
  // liste (le réglage lui-même reste dans le popup).
  const { alertRideIds } = useNotifications();

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
    if (target) setDetailRideId(initialRideId);
    deepLinkHandled.current = true;
  }, [initialRideId, waitTimes]);

  // Données VIVES de l'attraction ouverte dans le popup, relues à chaque
  // rafraîchissement de la liste.
  const foundDetailTarget =
    detailRideId != null
      ? (waitTimes.find((wt) => wt.rideId === detailRideId) ?? null)
      : null;

  // Dernière version connue, mémorisée APRÈS le rendu (jamais pendant : écrire
  // une ref en plein rendu n'est pas sûr en mode concurrent). Elle sert de filet
  // si l'attraction disparaît du flux — l'API du parc cesse de la renvoyer, ou
  // le fetch échoue : le popup garde alors ce qu'on avait au lieu de se vider
  // brutalement sous les doigts de l'utilisateur.
  const lastDetailTarget = useRef<WaitTime | null>(null);
  useEffect(() => {
    if (foundDetailTarget) lastDetailTarget.current = foundDetailTarget;
    else if (detailRideId == null) lastDetailTarget.current = null;
  }, [foundDetailTarget, detailRideId]);

  const liveDetailTarget =
    detailRideId != null
      ? (foundDetailTarget ?? lastDetailTarget.current)
      : null;

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

          // Nom découpé en « début » + « dernier mot » : ce dernier est rendu
          // dans le même bloc insécable que le chevron et la cloche (voir
          // `splitGluedTail`).
          const { head: nameHead, tail: nameTail } = splitGluedTail(
            waitTime.rideName,
          );

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
                      "cursor-pointer transition-colors duration-500 hover:bg-accent/50",
                      changedRides.has(`${waitTime.rideId}-standby`) &&
                        "bg-accent",
                    )}
                    // Toute la ligne ouvre le popup de détail ; seul le chevron
                    // (qui stoppe la propagation) déplie les files secondaires.
                    onClick={() => setDetailRideId(waitTime.rideId)}
                    // La ligne remplace l'ancienne icône « œil » : elle doit
                    // rester atteignable au clavier, d'où le tabIndex et la
                    // gestion d'Entrée / Espace.
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      setDetailRideId(waitTime.rideId);
                    }}
                  >
                    {/* Nom + chevron d'expand (si files multiples) accolé À LA
                        FIN DU NOM. Le nom peut passer à la ligne (min-w-0 +
                        wrap), le chevron reste sur la dernière ligne. */}
                    {/* pe resserré (surtout mobile) + chevron collé au nom :
                        marge réduite pour que le nom garde le MAXIMUM de largeur
                        et passe moins vite à la ligne. */}
                    {/* Rendu EN FLUX INLINE (pas de flex) : le nom coule et peut
                        passer sur plusieurs lignes ; le chevron suit directement
                        le dernier mot → il reste COLLÉ À LA FIN DU TEXTE, sur la
                        dernière ligne, quel que soit le nombre de lignes. Il est
                        `inline-flex align-middle`. */}
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
                      <span className="wrap-break-word">{nameHead}</span>
                      {/* Dernier mot + chevron : bloc insécable (voir plus haut). */}
                      <span className="whitespace-nowrap">
                        {nameTail}
                        {hasMultipleQueues && (
                          <button
                            type="button"
                            // Seule zone de la ligne qui NE déclenche PAS le
                            // popup : le clic doit être précis sur le chevron,
                            // d'où l'arrêt de la propagation vers la ligne.
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(waitTime.rideId);
                            }}
                            // La ligne écoute Entrée/Espace pour ouvrir le popup :
                            // sans ça, une validation au clavier sur le chevron
                            // déplierait ET ouvrirait le popup.
                            onKeyDown={(e) => e.stopPropagation()}
                            aria-expanded={isExpanded}
                            aria-label={t("toggleQueues", {
                              ride: waitTime.rideName,
                            })}
                            // p-1 (+ -my-1 pour ne pas grandir la ligne) : cible
                            // de clic confortable au doigt malgré une icône de
                            // 16 px, avec un fond au survol qui montre bien que
                            // le chevron est une commande distincte de la ligne.
                            // ms-1.5 : le pavé de survol ne doit pas toucher le
                            // texte (avec p-1, une simple marge de 2 px collait
                            // le fond au dernier caractère).
                            // `align-middle` cale le milieu de la boîte sur
                            // baseline + demi-hauteur d'x, soit ~1 px SOUS le
                            // centre optique de la ligne : d'où le `-top-px`, qui
                            // le recentre sans toucher au flux.
                            className="relative -top-px -my-1 ms-1.5 inline-flex rounded-md p-1 align-middle text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            <ChevronRight
                              className={cn(
                                "size-4 transition-transform duration-200",
                                isExpanded && "rotate-90",
                              )}
                            />
                          </button>
                        )}
                        {/* Cloche : alerte de temps d'attente active sur cette
                            attraction. Purement informative (le réglage est dans
                            le popup) et affichée à la place de l'ancien œil. */}
                        {alertRideIds.has(waitTime.rideId) && (
                          <BellRing
                            aria-label={tDetail("notifActive")}
                            className={cn(
                              "inline-block size-3.5 align-[-2px] text-primary",
                              // Après le chevron, son padding fait déjà l'espace :
                              // la cloche s'y recolle pour rester un même bloc
                              // d'icônes. Sans chevron, elle doit se décoller du
                              // texte comme le ferait le chevron lui-même.
                              hasMultipleQueues ? "ms-0.5" : "ms-1.5",
                            )}
                          />
                        )}
                      </span>
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
                      {getStatusBadge(standbyQueue.status, statusLabels, true)}
                    </div>
                  </div>
                )}

                {/* Files secondaires (visibles seulement si dépliées) */}
                {isExpanded &&
                  otherQueues.map((queue) => {
                    const queueLabel = getQueueLabel(queue.type);
                    const { head: queueHead, tail: queueTail } =
                      splitGluedTail(queueLabel);
                    const QueueIcon = QUEUE_TYPE_MAP[queue.type]?.icon;
                    return (
                    <div
                      key={`${waitTime.rideId}-${queue.type}`}
                      role="row"
                      className={cn(
                        GRID_COLS,
                        "cursor-pointer border-t transition-colors duration-500 hover:bg-accent/50",
                        changedRides.has(`${waitTime.rideId}-${queue.type}`) &&
                          "bg-accent",
                      )}
                      // Les files secondaires appartiennent à la même attraction :
                      // elles ouvrent le même popup que la ligne standby.
                      onClick={() => setDetailRideId(waitTime.rideId)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter" && e.key !== " ") return;
                        e.preventDefault();
                        setDetailRideId(waitTime.rideId);
                      }}
                    >
                      {/* Rendu EN FLUX INLINE, comme la ligne standby au-dessus,
                          et non plus en `flex items-center` : un libellé sur
                          deux lignes laissait sinon son icône de type de file
                          centrée verticalement à côté du bloc, détachée du
                          texte (surtout sur mobile).

                          Plus de retrait `ps-6` non plus : la flèche part du
                          MÊME bord gauche que les noms d'attraction, et le
                          libellé se colle à elle. La hiérarchie se lit à la
                          flèche et à la couleur atténuée, pas à un décalage qui
                          désalignait la colonne. */}
                      <div
                        role="rowheader"
                        className="min-w-0 py-2 pe-2 font-medium text-muted-foreground"
                      >
                        <CornerDownRight className="me-0.5 inline-block size-3.5 align-[-2px]" />
                        <span className="wrap-break-word">{queueHead}</span>
                        {/* Dernier mot + icône de type : bloc insécable. */}
                        <span className="whitespace-nowrap">
                          {queueTail}
                          {QueueIcon && (
                            <QueueIcon className="ms-1 inline-block size-3.5 align-[-2px]" />
                          )}
                        </span>
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
                        {getStatusBadge(queue.status, statusLabels, true)}
                      </div>
                    </div>
                    );
                  })}
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

      {/* Popup « détail attraction », ouvert par un clic sur une ligne. */}
      <AttractionDetailDialog
        target={liveDetailTarget}
        parkIdentifier={parkIdentifier}
        parkName={parkName}
        reopenAllowed={reopenAllowed}
        onOpenChange={(open) => {
          if (!open) setDetailRideId(null);
        }}
      />
    </div>
  );
}
