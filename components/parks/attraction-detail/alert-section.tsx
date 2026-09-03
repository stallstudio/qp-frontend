"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { BellRing, Loader2, Trash2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import NumberStepper from "@/components/ui/number-stepper";
import {
  ALERT_THRESHOLDS,
  defaultThresholdForWait,
} from "@/lib/alert-thresholds";
import { useUser } from "@/components/providers/user-provider";
import { useNotifications } from "@/components/providers/notifications-provider";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import NotificationGate from "@/components/parks/notification-gate";
import type { AlertDTO, AlertType } from "@/types/user";
import type { WaitTimeStatus } from "@/types/waitTime";

type AlertSectionProps = {
  rideId: number;
  rideName: string;
  parkIdentifier: string;
  parkName: string;
  // Temps d'attente standby actuel (si disponible/ouvert) : sert à proposer un
  // seuil par défaut « un cran en dessous » pour une nouvelle alerte.
  currentWaitTime?: number;
  // État courant de la file standby. C'est lui qui décide de la NATURE de
  // l'alerte proposée (voir `alertModeFor`).
  currentStatus?: WaitTimeStatus | null;
  // Le parc laisse-t-il encore le temps à une alerte de RÉOUVERTURE de servir ?
  // false quand il est fermé ou trop proche de sa fermeture — voir la règle
  // partagée `lib/park-closing.ts`, appliquée par la carte parente. Non fourni =
  // on autorise (on ne conclut pas d'une absence d'information).
  reopenAllowed?: boolean;
  // Attraction indisponible sur une longue période : on n'autorise pas d'alerte
  // (aucun temps d'attente à surveiller).
  unavailable?: boolean;
};

// Nature d'alerte pertinente pour l'état courant de l'attraction. Les deux
// s'excluent, et c'est voulu :
//   • ouverte -> SEUIL. Proposer « préviens-moi à la réouverture » n'aurait
//     aucun sens : elle est déjà ouverte, la notification ne partirait jamais.
//   • à l'arrêt -> RÉOUVERTURE. Aucun temps d'attente n'est publié, donc aucun
//     seuil ne peut être franchi : une alerte de seuil resterait muette.
// Sans file standby (statut inconnu), on garde le comportement d'origine.
function alertModeFor(status: WaitTimeStatus | null | undefined): AlertType {
  return status && status !== "open" ? "reopen" : "threshold";
}

// Alertes de temps d'attente de l'attraction. Disponibles uniquement connecté ;
// sinon on guide l'utilisateur vers l'action à effectuer (installer / se connecter).
//
// Le Web Push marche DANS L'ONGLET sur desktop (Chrome/Edge/Firefox/Safari) et
// sur Android Chrome — aucune installation requise. Le SEUL cas qui l'impose est
// iOS/iPadOS : Safari ne délivre le push que si l'app est ajoutée à l'écran
// d'accueil. On garde donc l'écran d'installation UNIQUEMENT sur mobile non
// installé (iOS par nécessité, Android par choix produit — meilleure UX depuis
// l'app installée) ; sur desktop on va directement au formulaire.
export default function AlertSection({
  unavailable,
  ...props
}: AlertSectionProps) {
  const t = useTranslations("attractionDetail");

  // Indisponible en continu : aucune file à surveiller -> on ne propose pas
  // d'alerte, on l'explique simplement (centré dans l'espace réservé).
  if (unavailable) {
    return (
      <div className="flex min-h-[136px] items-center justify-center">
        <p className="text-center text-sm text-muted-foreground">
          {t("alertsUnavailable")}
        </p>
      </div>
    );
  }

  // Attraction à l'arrêt, mais le parc est fermé ou sur le point de l'être : la
  // seule alerte qui aurait un sens est celle de réouverture, et elle n'en a
  // plus. Parc fermé, elle ne survivrait pas à la nuit (les alertes ne valent
  // que pour la journée en cours) ; à une heure de la fermeture, ce qui s'arrête
  // s'arrête pour la nuit. On le dit plutôt que d'enregistrer une promesse
  // qu'on ne tiendra pas — et que la route de création refuserait de toute façon.
  if (
    props.reopenAllowed === false &&
    alertModeFor(props.currentStatus) === "reopen"
  ) {
    return (
      <div className="flex min-h-[136px] items-center justify-center">
        <p className="text-center text-sm text-muted-foreground">
          {t("reopenTooLate")}
        </p>
      </div>
    );
  }

  // Séquence installer/se connecter mutualisée avec les rappels de spectacles.
  return (
    <NotificationGate>
      <AlertForm {...props} />
    </NotificationGate>
  );
}

// —————————————————————— PWA + connecté : formulaire complet ——————————————————————

function AlertForm({
  rideId,
  rideName,
  parkIdentifier,
  parkName,
  currentWaitTime,
  currentStatus,
}: AlertSectionProps) {
  const t = useTranslations("attractionDetail");
  const tAlert = useTranslations("alerts");
  const tStatus = useTranslations("attractionStatus");
  const { refresh } = useUser();
  // Rafraîchit la cloche « alerte active » affichée sur la ligne de la liste.
  const { refresh: refreshNotifications } = useNotifications();
  const push = usePushNotifications();
  // Nature de l'alerte, dictée par l'état de l'attraction — jamais par un choix
  // de l'utilisateur : les deux natures ne sont pas des options concurrentes,
  // c'est l'attraction qui détermine celle qui peut fonctionner.
  const mode = alertModeFor(currentStatus);
  // Défaut d'une nouvelle alerte : un cran sous le temps actuel de l'attraction.
  const defaultThreshold = defaultThresholdForWait(currentWaitTime);
  const [threshold, setThreshold] = useState(defaultThreshold);
  const [stored, setStored] = useState<AlertDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Charge l'alerte existante de cette attraction (pré-remplit le seuil).
  useEffect(() => {
    let cancelled = false;
    axios
      .get<AlertDTO[]>("/api/user/alerts")
      .then((res) => {
        if (cancelled) return;
        const found = res.data.find((n) => n.rideId === rideId) ?? null;
        setStored(found);
        if (found?.threshold != null) setThreshold(found.threshold);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rideId]);

  // L'alerte en base ne compte comme « existante » que si elle est de la MÊME
  // nature que celle qu'on propose. Une alerte de réouverture déjà consommée
  // traîne jusqu'au soir sur une attraction désormais ouverte : l'afficher comme
  // l'alerte de seuil en cours serait faux, et son bouton « supprimer » ferait
  // disparaître autre chose que ce qu'il annonce. L'enregistrement, lui, écrase
  // la ligne quoi qu'il arrive (upsert sur userId+rideId).
  const existing = stored && stored.type === mode ? stored : null;

  // Le popup suit le direct : l'attraction peut rouvrir (ou tomber en panne)
  // pendant qu'il est ouvert, et le formulaire change alors de nature sous les
  // yeux de l'utilisateur. Quand il bascule vers le mode SEUIL, le sélecteur
  // doit repartir du temps d'attente qui vient d'apparaître — sa valeur d'alors
  // avait été calculée sans temps d'attente (attraction à l'arrêt) et ne voulait
  // rien dire ici.
  //
  // Dépendances volontairement réduites à `mode` : `defaultThreshold` change à
  // chaque rafraîchissement des temps, le suivre écraserait le choix manuel de
  // l'utilisateur toutes les minutes. Le premier rendu est ignoré pour ne pas
  // court-circuiter le seuil chargé depuis une alerte existante.
  const previousMode = useRef<AlertType | null>(null);
  useEffect(() => {
    const changed = previousMode.current !== null && previousMode.current !== mode;
    previousMode.current = mode;
    if (changed && mode === "threshold") setThreshold(defaultThreshold);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const save = async () => {
    setSaving(true);
    try {
      // Avant d'enregistrer, on s'assure que CET appareil est abonné au push
      // (permission + PushManager). Le clic « Enregistrer » est le geste
      // utilisateur qui autorise la demande de permission du navigateur.
      let pushOk = push.subscribed;
      if (push.supported && !push.subscribed) {
        pushOk = await push.subscribe();
      }

      const { data } = await axios.post<AlertDTO>("/api/user/alerts", {
        rideId,
        rideName,
        parkIdentifier,
        parkName,
        type: mode,
        // Une alerte de réouverture n'a pas de seuil : ne rien envoyer plutôt
        // qu'une valeur que le serveur devrait ignorer.
        ...(mode === "threshold" ? { threshold } : {}),
      });
      setStored(data);
      refresh();
      refreshNotifications();

      // L'alerte est enregistrée quoi qu'il arrive ; on prévient juste si ce
      // navigateur ne pourra pas recevoir les push (permission refusée / non
      // supportée) — d'autres appareils de l'utilisateur le peuvent.
      if (push.supported && !pushOk) {
        toast.warning(t("pushBlocked"));
      } else {
        toast.success(mode === "reopen" ? t("reopenSaved") : t("saved"));
      }
    } catch (err) {
      // 409 : l'attraction a changé d'état entre l'ouverture du popup et
      // l'envoi (réparée, ou tombée en panne). Le serveur refuse alors une
      // alerte qui ne pourrait plus se déclencher ; on le dit clairement au lieu
      // du message d'échec générique, et on invite à rouvrir la fiche.
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        toast.error(t("statusChanged"));
      } else {
        toast.error(tAlert("createError"));
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/user/alerts/${existing.id}`);
      setStored(null);
      setThreshold(defaultThreshold);
      toast.success(t("deleted"));
      refresh();
      refreshNotifications();
    } catch {
      toast.error(tAlert("createError"));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isReopen = mode === "reopen";

  // « dirty » autorise l'enregistrement : nouvelle alerte, seuil modifié, ou
  // alerte existante désactivée (le POST la réactive). Une alerte de réouverture
  // n'a pas de réglage : elle est soit posée, soit à poser — rien à modifier.
  const dirty = isReopen
    ? !existing || !existing.active
    : !existing || !existing.active || existing.threshold !== threshold;

  return (
    <div className="flex flex-col items-center gap-3">
      {isReopen ? (
        // Mode RÉOUVERTURE : pas de sélecteur de seuil (il n'y a rien à
        // paramétrer), mais l'état constaté est rappelé — c'est lui qui justifie
        // qu'on propose cette alerte-là et pas l'autre.
        <>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <Wrench className="size-3.5" />
            {tStatus(currentStatus ?? "closed")}
          </span>
          <span className="text-center text-sm font-medium">
            {t("reopenLabel")}
          </span>
        </>
      ) : (
        <>
          <span className="text-center text-sm font-medium">
            {tAlert("thresholdLabel")}
          </span>
          <NumberStepper
            value={threshold}
            onChange={setThreshold}
            values={ALERT_THRESHOLDS}
            format={(v) => tAlert("thresholdOption", { minutes: v })}
            aria-label={tAlert("thresholdLabel")}
          />
        </>
      )}

      {existing?.active && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          <BellRing className="size-3.5" />
          {isReopen ? t("reopenActive") : t("notifActive")}
        </span>
      )}

      {/* Permission navigateur refusée : l'alerte est enregistrée mais ce
          navigateur ne recevra rien tant que l'utilisateur ne réautorise pas les
          notifications dans les réglages du site. */}
      {push.supported && push.permission === "denied" && (
        <p className="text-center text-xs text-destructive">
          {t("pushDenied")}
        </p>
      )}

      {/* Navigateur sans Web Push (rare, ex. très ancien) : on le dit clairement
          plutôt que de laisser croire que l'alerte sera reçue ici. */}
      {push.ready && !push.supported && (
        <p className="text-center text-xs text-muted-foreground">
          {t("pushUnsupported")}
        </p>
      )}

      <div className="flex w-full gap-2 pt-1">
        <Button
          onClick={save}
          disabled={saving || (!!existing && !dirty)}
          className="flex-1"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {isReopen
            ? t("reopenSave")
            : existing
              ? t("update")
              : t("save")}
        </Button>
        {existing && (
          // Même corbeille que le fil du profil : bouton fantôme teinté en
          // destructif, plutôt qu'un bouton contour neutre. La suppression se
          // fait désormais UNIQUEMENT ici, elle doit se lire du premier coup.
          <Button
            variant="ghost"
            size="icon"
            onClick={remove}
            disabled={deleting}
            aria-label={t("delete")}
            className="text-destructive hover:text-destructive"
          >
            {deleting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
