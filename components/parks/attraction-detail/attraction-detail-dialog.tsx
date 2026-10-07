"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, FerrisWheel } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { WaitTime } from "@/types/waitTime";
import { useRideHistory } from "@/hooks/useRideHistory";
import { getPrimaryQueue } from "@/lib/poi-list";
import { CHARTED_QUEUE_TYPES, STANDBY_QUEUE } from "@/lib/queue-types";
import { MACK_WAIT_CAP } from "@/lib/wait-time-cap";
import ImageSection from "./image-section";
import LiveStats from "./live-stats";
import PoiFacts from "./poi-facts";
import AlertSection from "./alert-section";
import ChartSection from "./chart-section";
import { usePoiHoursOf } from "@/components/parks/poi-hours-context";

type AttractionDetailDialogProps = {
  target: WaitTime | null;
  parkIdentifier: string;
  parkName: string;
  // Le parc laisse-t-il encore le temps à une alerte de réouverture de servir ?
  // Voir `AlertSection`. Non fourni = on autorise.
  reopenAllowed?: boolean;
  // File affichée : `standby` (l'attraction) par défaut, ou une file secondaire
  // — Single Rider, file virtuelle, Disney Premier Access… — ouverte depuis sa
  // propre ligne de la liste.
  queueType?: string;
  // Nom affiché de cette file (« Disney Premier Access »), voir `getQueueLabel`.
  queueLabel?: string;
  // Bascule le popup sur une autre file de la même attraction (la ligne « Voir
  // l'attraction » d'un popup de file).
  onSelectQueue?: (queueType: string) => void;
  onOpenChange: (open: boolean) => void;
};

// Popup « détail attraction » (refonte du 2026-10-07) : bannière, bandeau de
// chiffres à cheval dessus (attente, état, horaires), puis l'alerte, réduite à
// une ligne qui se déplie, et le graphique du jour. Plus de titres de section
// ni de séparateurs : chaque bloc se reconnaît à sa forme. Ouvert quand
// `target` est non nul.
//
// ⚠️ **Le même popup sert aux FILES secondaires** (2026-10-07) : tout s'y lit
// alors sur la file elle-même — son attente ou son créneau, son état, son
// alerte. Le graphique n'existe que pour les files à attente classique
// (`CHARTED_QUEUE_TYPES`) : un créneau ou une file virtuelle ne se prévoient
// pas.
export default function AttractionDetailDialog({
  target,
  parkIdentifier,
  parkName,
  reopenAllowed = true,
  queueType = STANDBY_QUEUE,
  queueLabel,
  onSelectQueue,
  onOpenChange,
}: AttractionDetailDialogProps) {
  const t = useTranslations("attractionDetail");
  const isStandby = queueType === STANDBY_QUEUE;
  const charted = CHARTED_QUEUE_TYPES.has(queueType);
  // La file dont le popup parle. Pour l'attraction, celle qui la représente
  // dans la liste (`getPrimaryQueue`).
  const queue = target
    ? isStandby
      ? getPrimaryQueue(target)
      : target.queues.find((q) => q.type === queueType)
    : undefined;
  // Les heures du jour, quand la page de parc les a (voir `PoiHoursProvider`).
  const hours = usePoiHoursOf(target?.rideId);
  // Le seuil d'alerte que le graphique matérialise, remonté par `AlertSection`.
  const [alertThreshold, setAlertThreshold] = useState<number | null>(null);

  // Historique + prévision (rafraîchis toutes les 60 s tant que le popup est
  // ouvert) : le graphique les affiche, et la section Alertes s'en sert pour
  // savoir si l'attraction est indisponible en continu. Le hook est partagé avec
  // la page dédiée de l'attraction. Aucune requête pour une file sans
  // graphique.
  const {
    history,
    loading: historyLoading,
    chronicallyUnavailable,
  } = useRideHistory(
    parkIdentifier,
    target && charted ? target.rideId : null,
    queueType,
  );

  // Temps actuel de la file (seulement si ouverte et exploitable) : sert au
  // seuil par défaut « un cran en dessous », à la phrase de conseil sous le
  // graphique, ET de garde-fou contre un verdict d'historique erroné (voir plus
  // bas).
  const watched = target?.queues.find((q) => q.type === queueType);
  const currentWaitTime =
    watched && watched.status === "open" && watched.waitTime >= 0
      ? watched.waitTime
      : undefined;
  // État de la file : c'est lui qui décide de la NATURE de l'alerte proposée
  // (seuil si ouverte, réouverture sinon, créneau si elle en publie un). Sans
  // file standby, on laisse le formulaire à son comportement d'origine (alerte
  // de seuil).
  const currentStatus = watched?.status ?? null;
  const currentSlot = watched?.timeSlot ?? null;

  // Une file secondaire OUVERTE qui ne publie ni attente ni créneau (la
  // VirtualLine d'Europa-Park, certains Single Rider) : rien à surveiller.
  // L'attraction, elle, garde son comportement d'origine.
  const queueSilent =
    !isStandby &&
    currentStatus === "open" &&
    !currentSlot &&
    currentWaitTime === undefined;
  // L'historique peut se tromper (parc récemment ajouté, collecte
  // interrompue) : s'il affiche un temps d'attente EN CE MOMENT, le direct
  // tranche et on laisse poser une alerte.
  const historyUnavailable =
    charted && chronicallyUnavailable && currentWaitTime === undefined;

  const hasStandby = !!target?.queues.some((q) => q.type === STANDBY_QUEUE);

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      {/* rounded-4xl : même radius que l'en-tête de parc et le container temps
          d'attente (main-card). overflow-hidden clippe l'image du haut sur les
          coins arrondis ; le défilement est confié au seul corps (voir plus bas).
          Layout en colonne flex : en-tête ÉPINGLÉE (image + bandeau,
          `shrink-0`) + corps DÉFILANT (`flex-1 min-h-0 overflow-y-auto`). Ainsi
          le bouton favori et les chiffres du direct restent TOUJOURS visibles,
          quoi qu'il arrive au montage des sections asynchrones (alerte,
          graphique). */}
      <DialogContent
        className="flex max-h-[88dvh] flex-col gap-0 overflow-hidden rounded-4xl border-0 p-0 sm:max-w-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {target && (
          <>
            {/* Titre/description accessibles (le nom visible est sur la photo). */}
            <DialogHeader className="sr-only">
              <DialogTitle>
                {isStandby
                  ? target.rideName
                  : `${queueLabel ?? queueType} · ${target.rideName}`}
              </DialogTitle>
              <DialogDescription>
                {t("openFor", { ride: target.rideName })}
              </DialogDescription>
            </DialogHeader>

            {/* En-tête épinglée : bannière (nom, zone, étoile) et, à cheval sur
                son bas, le bandeau de chiffres — voir `LiveStats` pour la
                raison de sa place ici. Pour une file : son nom en titre,
                l'attraction dessous ; l'étoile reste celle de l'attraction. */}
            <div className="shrink-0">
              <ImageSection
                title={isStandby ? target.rideName : (queueLabel ?? queueType)}
                subtitle={isStandby ? undefined : target.rideName}
                favNamespace="rides"
                favKey={`${parkIdentifier}:${target.rideId}`}
                place={target.zone}
                banner={target.banner}
                credit={parkName}
                overlapped
              />
              <div className="relative z-10 -mt-10 px-4">
                <LiveStats
                  queue={queue}
                  hours={hours}
                  // Le plafond de la source vient avec l'historique ; avant, on
                  // garde le défaut des listes (`getWaitTimeBadge`).
                  waitCap={history ? history.meta.waitCap : MACK_WAIT_CAP}
                />
              </div>
            </div>

            {/* Corps défilant. `scrollbar-hide` masque la barre de défilement
                (le petit dépassement résiduel reste scrollable, mais sans barre
                visible). `key` : changer d'attraction ou de file sans fermer
                le popup repart d'une alerte repliée. */}
            <div
              key={`${target.rideId}:${queueType}`}
              className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pt-5 pb-5 scrollbar-hide *:shrink-0"
            >
              {/* Peur et prix d'une maison hantée publiée en attraction —
                  rien pour un manège ordinaire. Une ligne : l'alerte reste
                  au-dessus de la flottaison. */}
              <PoiFacts fearLevel={target.fearLevel} price={target.price} />

              {/* ⚠️ L'alerte AVANT le graphique (2026-10-07) : placée dessous,
                  elle tombait sous la ligne de flottaison sur un iPhone, et
                  rien ne disait qu'elle existait. C'est la seule action du
                  popup, le reste se lit. */}
              <AlertSection
                rideId={target.rideId}
                rideName={target.rideName}
                parkIdentifier={parkIdentifier}
                parkName={parkName}
                queueType={queueType}
                currentSlot={currentSlot}
                timezone={hours?.timezone ?? history?.timezone ?? null}
                unavailable={historyUnavailable || queueSilent}
                unavailableMessage={
                  isStandby ? undefined : t("queueNothingToWatch")
                }
                currentWaitTime={currentWaitTime}
                currentStatus={currentStatus}
                reopenAllowed={reopenAllowed}
                onThresholdPreview={setAlertThreshold}
              />

              {charted && (
                <ChartSection
                  data={history}
                  loading={historyLoading}
                  currentWaitTime={currentWaitTime}
                  currentStatus={currentStatus}
                  threshold={alertThreshold}
                />
              )}

              {/* Popup d'une file : retour à l'attraction elle-même, son
                  graphique et son alerte. */}
              {!isStandby && hasStandby && onSelectQueue && (
                <button
                  type="button"
                  onClick={() => onSelectQueue(STANDBY_QUEUE)}
                  className="flex w-full items-center gap-3 rounded-2xl border bg-muted/40 px-3 py-2.5 text-left transition-colors hover:bg-muted"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                    <FerrisWheel className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {t("queueSeeRide")}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {target.rideName}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
