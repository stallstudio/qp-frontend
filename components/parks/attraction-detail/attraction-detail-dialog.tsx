"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
import { MACK_WAIT_CAP } from "@/lib/wait-time-cap";
import ImageSection from "./image-section";
import LiveStats from "./live-stats";
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
  onOpenChange: (open: boolean) => void;
};

// Popup « détail attraction » (refonte du 2026-10-07) : bannière, bandeau de
// chiffres à cheval dessus (attente, état, horaires), puis le graphique du jour
// et l'alerte, réduite à une ligne qui se déplie. Plus de titres de section ni
// de séparateurs : chaque bloc se reconnaît à sa forme. Ouvert quand `target`
// est non nul.
export default function AttractionDetailDialog({
  target,
  parkIdentifier,
  parkName,
  reopenAllowed = true,
  onOpenChange,
}: AttractionDetailDialogProps) {
  const t = useTranslations("attractionDetail");
  const queue = target ? getPrimaryQueue(target) : undefined;
  // Les heures du jour, quand la page de parc les a (voir `PoiHoursProvider`).
  const hours = usePoiHoursOf(target?.rideId);
  // Le seuil d'alerte que le graphique matérialise, remonté par `AlertSection`.
  const [alertThreshold, setAlertThreshold] = useState<number | null>(null);

  // Historique + prévision (rafraîchis toutes les 60 s tant que le popup est
  // ouvert) : le graphique les affiche, et la section Alertes s'en sert pour
  // savoir si l'attraction est indisponible en continu. Le hook est partagé avec
  // la page dédiée de l'attraction.
  const {
    history,
    loading: historyLoading,
    chronicallyUnavailable,
  } = useRideHistory(parkIdentifier, target?.rideId ?? null);

  // Temps standby actuel (seulement si ouvert et exploitable) : sert au seuil par
  // défaut « un cran en dessous », à la phrase de conseil sous le graphique, ET
  // de garde-fou contre un verdict d'historique erroné (voir plus bas).
  const standby = target?.queues.find((q) => q.type === "standby");
  const currentWaitTime =
    standby && standby.status === "open" && standby.waitTime >= 0
      ? standby.waitTime
      : undefined;
  // État de la file standby : c'est lui qui décide de la NATURE de l'alerte
  // proposée (seuil si ouverte, réouverture sinon). Sans file standby, on laisse
  // le formulaire à son comportement d'origine (alerte de seuil).
  const currentStatus = standby?.status ?? null;

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
              <DialogTitle>{target.rideName}</DialogTitle>
              <DialogDescription>
                {t("openFor", { ride: target.rideName })}
              </DialogDescription>
            </DialogHeader>

            {/* En-tête épinglée : bannière (nom, zone, étoile) et, à cheval sur
                son bas, le bandeau de chiffres — voir `LiveStats` pour la
                raison de sa place ici. */}
            <div className="shrink-0">
              <ImageSection
                title={target.rideName}
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
                visible). `key` : changer d'attraction sans fermer le popup
                repart d'une alerte repliée. */}
            <div
              key={target.rideId}
              className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pt-5 pb-5 scrollbar-hide *:shrink-0"
            >
              {/* ⚠️ L'alerte AVANT le graphique (2026-10-07) : placée dessous,
                  elle tombait sous la ligne de flottaison sur un iPhone, et
                  rien ne disait qu'elle existait. C'est la seule action du
                  popup, le reste se lit. */}
              <AlertSection
                rideId={target.rideId}
                rideName={target.rideName}
                parkIdentifier={parkIdentifier}
                parkName={parkName}
                // L'historique peut se tromper (parc récemment ajouté, collecte
                // interrompue) : s'il affiche un temps d'attente EN CE MOMENT,
                // le direct tranche et on laisse poser une alerte.
                unavailable={
                  chronicallyUnavailable && currentWaitTime === undefined
                }
                currentWaitTime={currentWaitTime}
                currentStatus={currentStatus}
                reopenAllowed={reopenAllowed}
                onThresholdPreview={setAlertThreshold}
              />

              <ChartSection
                data={history}
                loading={historyLoading}
                currentWaitTime={currentWaitTime}
                currentStatus={currentStatus}
                threshold={alertThreshold}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
