"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  Bell,
  BellOff,
  BellRing,
  ChevronRight,
  Loader2,
  TicketCheck,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { DateTime } from "luxon";
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
import { cn, getLuxonFormat } from "@/lib/utils";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { STANDBY_QUEUE } from "@/lib/queue-types";
import type { AlertDTO, AlertType } from "@/types/user";
import type { TimeSlot, WaitTimeStatus } from "@/types/waitTime";

type AlertSectionProps = {
  rideId: number;
  rideName: string;
  parkIdentifier: string;
  parkName: string;
  // File surveillée : `standby` (l'attraction elle-même) par défaut, ou une
  // file secondaire depuis son propre popup. Une alerte par file.
  queueType?: string;
  // Créneau que la file propose en ce moment (Disney Premier Access, file
  // virtuelle) : c'est lui qui fait passer l'alerte en mode CRÉNEAU.
  currentSlot?: TimeSlot | null;
  // Fuseau du parc, pour ne proposer que des heures de créneau À VENIR. Sans
  // lui, la liste n'est pas bornée par l'heure qu'il est.
  timezone?: string | null;
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
  // Le texte de cette ligne inerte, quand ce n'est pas celui de l'attraction
  // (une file secondaire qui ne publie rien à surveiller).
  unavailableMessage?: string;
  // Le seuil à matérialiser sur le graphique du popup : celui qu'on règle
  // (carte dépliée) ou celui de l'alerte active ; `null` sinon.
  onThresholdPreview?: (threshold: number | null) => void;
};

// Nature d'alerte pertinente pour l'état courant de l'attraction. Les deux
// s'excluent, et c'est voulu :
//   • ouverte -> SEUIL. Proposer « préviens-moi à la réouverture » n'aurait
//     aucun sens : elle est déjà ouverte, la notification ne partirait jamais.
//   • à l'arrêt -> RÉOUVERTURE. Aucun temps d'attente n'est publié, donc aucun
//     seuil ne peut être franchi : une alerte de seuil resterait muette.
// Sans file standby (statut inconnu), on garde le comportement d'origine.
//   • ouverte ET un créneau publié -> CRÉNEAU : une file à créneau n'a pas de
//     durée d'attente qui baisse, on guette une heure de passage plus tôt.
function alertModeFor(
  status: WaitTimeStatus | null | undefined,
  slot?: TimeSlot | null,
): AlertType {
  if (status && status !== "open") return "reopen";
  return slot ? "slot" : "threshold";
}

// Pas de la liste d'heures d'une alerte de créneau, et sa longueur : deux
// heures en quarts d'heure avant le créneau actuel.
const SLOT_STEP_MINUTES = 15;
const SLOT_OPTIONS = 8;

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const toHhmm = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/**
 * Heures proposées pour « un créneau avant… », en minutes depuis minuit (heure
 * du parc), croissantes : les quarts d'heure STRICTEMENT antérieurs au début du
 * créneau actuel — un créneau à 13:05 donne 13:00, 12:45… — et postérieurs à
 * maintenant quand le fuseau est connu. Vide si plus rien ne peut arriver.
 */
function slotOptions(slot: TimeSlot, timezone?: string | null): number[] {
  const start = toMinutes(slot.start);
  const now = timezone
    ? DateTime.now().setZone(timezone)
    : null;
  const floor = now ? now.hour * 60 + now.minute : 0;
  const first = Math.ceil(start / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES - SLOT_STEP_MINUTES;
  const out: number[] = [];
  for (let m = first; m >= 0 && out.length < SLOT_OPTIONS; m -= SLOT_STEP_MINUTES) {
    if (m < floor) break;
    out.unshift(m);
  }
  return out;
}

// Mêmes dimensions pour la ligne repliée, la ligne « alerte active » et la
// carte dépliée : elles se remplacent au même endroit.
const ROW =
  "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left";
const ICON_TILE = "grid size-8 shrink-0 place-items-center rounded-lg";

// Alertes de temps d'attente de l'attraction, en UNE LIGNE repliée sous le
// graphique (refonte du 2026-10-07) : l'ancien encart « Connectez-vous » était
// le plus gros bloc du popup, pour l'information la moins consultée. Un clic
// déplie la ligne en carte de réglage ; une fois l'alerte posée, la ligne dit
// qu'elle est active, avec « Modifier » et la corbeille.
//
// Le Web Push marche DANS L'ONGLET sur desktop (Chrome/Edge/Firefox/Safari) et
// sur Android Chrome — aucune installation requise. Le SEUL cas qui l'impose est
// iOS/iPadOS : Safari ne délivre le push que si l'app est ajoutée à l'écran
// d'accueil. On garde donc l'écran d'installation UNIQUEMENT sur mobile non
// installé (iOS par nécessité, Android par choix produit — meilleure UX depuis
// l'app installée) ; sur desktop on va directement au formulaire.
export default function AlertSection({
  unavailable,
  unavailableMessage,
  ...props
}: AlertSectionProps) {
  const t = useTranslations("attractionDetail");

  // Indisponible en continu : aucune file à surveiller -> on ne propose pas
  // d'alerte, on l'explique simplement.
  if (unavailable) {
    return (
      <AlertNotice>{unavailableMessage ?? t("alertsUnavailable")}</AlertNotice>
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
    alertModeFor(props.currentStatus, props.currentSlot) === "reopen"
  ) {
    return <AlertNotice>{t("reopenTooLate")}</AlertNotice>;
  }

  return <AlertPanel {...props} />;
}

// Ligne inerte, en pointillés : l'alerte n'est pas possible, et on dit pourquoi.
function AlertNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn(ROW, "border-dashed text-muted-foreground")}>
      <span className={cn(ICON_TILE, "bg-muted")}>
        <BellOff className="size-4" />
      </span>
      <p className="min-w-0 flex-1 text-sm">{children}</p>
    </div>
  );
}

function AlertPanel({
  rideId,
  rideName,
  parkIdentifier,
  parkName,
  queueType = STANDBY_QUEUE,
  currentSlot,
  timezone,
  currentWaitTime,
  currentStatus,
  onThresholdPreview,
}: Omit<
  AlertSectionProps,
  "unavailable" | "unavailableMessage" | "reopenAllowed"
>) {
  const t = useTranslations("attractionDetail");
  const tAlert = useTranslations("alerts");
  const tStatus = useTranslations("attractionStatus");
  const { isAuthenticated, refresh } = useUser();
  // Rafraîchit la cloche « alerte active » affichée sur la ligne de la liste.
  const { refresh: refreshNotifications } = useNotifications();
  const push = usePushNotifications();
  // Nature de l'alerte, dictée par l'état de l'attraction — jamais par un choix
  // de l'utilisateur : les deux natures ne sont pas des options concurrentes,
  // c'est l'attraction qui détermine celle qui peut fonctionner.
  const mode = alertModeFor(currentStatus, currentSlot);
  const isReopen = mode === "reopen";
  const isSlot = mode === "slot";
  const isStandby = queueType === STANDBY_QUEUE;
  const { is12Hour } = useTimeFormat();
  const timeLabel = (minutes: number) =>
    DateTime.fromObject({
      hour: Math.floor(minutes / 60),
      minute: minutes % 60,
    }).toFormat(getLuxonFormat(is12Hour));
  // Heures proposées pour une alerte de créneau, et la valeur choisie : par
  // défaut la plus TARDIVE, la seule qui a une chance réaliste d'arriver.
  const slotChoices = currentSlot ? slotOptions(currentSlot, timezone) : [];
  const [slotBefore, setSlotBefore] = useState<number | null>(null);
  const slotValue =
    slotBefore != null && slotChoices.includes(slotBefore)
      ? slotBefore
      : (slotChoices[slotChoices.length - 1] ?? null);
  // Défaut d'une nouvelle alerte : un cran sous le temps actuel de l'attraction.
  const defaultThreshold = defaultThresholdForWait(currentWaitTime);
  const [expanded, setExpanded] = useState(false);
  const [threshold, setThreshold] = useState(defaultThreshold);
  const [stored, setStored] = useState<AlertDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Charge l'alerte existante de cette attraction dès l'ouverture du popup, et
  // non au dépliage : c'est elle qui décide si la ligne repliée affiche
  // « Alerte active ». Rien à charger sans compte.
  useEffect(() => {
    if (!isAuthenticated) {
      setStored(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    axios
      .get<AlertDTO[]>("/api/user/alerts")
      .then((res) => {
        if (cancelled) return;
        const found =
          res.data.find(
            (n) => n.rideId === rideId && n.queueType === queueType,
          ) ?? null;
        setStored(found);
        if (found?.threshold != null) setThreshold(found.threshold);
        if (found?.slotBefore) setSlotBefore(toMinutes(found.slotBefore));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rideId, queueType, isAuthenticated]);

  // L'alerte en base ne compte comme « existante » que si elle est de la MÊME
  // nature que celle qu'on propose. Une alerte de réouverture déjà consommée
  // traîne jusqu'au soir sur une attraction désormais ouverte : l'afficher comme
  // l'alerte de seuil en cours serait faux, et son bouton « supprimer » ferait
  // disparaître autre chose que ce qu'il annonce. L'enregistrement, lui, écrase
  // la ligne quoi qu'il arrive (upsert sur userId+rideId).
  const existing = stored && stored.type === mode ? stored : null;
  const active = existing?.active ? existing : null;

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

  // Le seuil tracé sur le graphique : en réglage (connecté), la valeur du
  // sélecteur ; replié, celle de l'alerte active. Jamais en mode réouverture,
  // qui n'a pas de seuil.
  const preview = isReopen || isSlot
    ? null
    : expanded && isAuthenticated
      ? threshold
      : (active?.threshold ?? null);
  useEffect(() => {
    onThresholdPreview?.(preview);
  }, [preview, onThresholdPreview]);
  // Démonté (attraction devenue indisponible, popup fermé) : plus de ligne.
  useEffect(() => () => onThresholdPreview?.(null), [onThresholdPreview]);

  const save = async () => {
    setSaving(true);
    try {
      // Avant d'enregistrer, on s'assure que CET appareil est abonné au push
      // (permission + PushManager). Le clic « Activer » est le geste
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
        // Rien pour la file standby : l'appel reste celui que connaissent les
        // versions précédentes du serveur.
        ...(isStandby ? {} : { queueType }),
        // Une alerte de réouverture n'a pas de seuil : ne rien envoyer plutôt
        // qu'une valeur que le serveur devrait ignorer.
        ...(mode === "threshold" ? { threshold } : {}),
        ...(mode === "slot" && slotValue != null
          ? { slotBefore: toHhmm(slotValue) }
          : {}),
      });
      setStored(data);
      setExpanded(false);
      refresh();
      refreshNotifications();

      // L'alerte est enregistrée quoi qu'il arrive ; on prévient juste si ce
      // navigateur ne pourra pas recevoir les push (permission refusée / non
      // supportée) — d'autres appareils de l'utilisateur le peuvent.
      if (push.supported && !pushOk) {
        toast.warning(t("pushBlocked"));
      } else {
        toast.success(isReopen ? t("reopenSaved") : t("saved"));
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

  const title = isReopen
    ? t("reopenSave")
    : isSlot
      ? t("slotRowTitle")
      : t("alertRowTitle");
  const ModeIcon = isReopen ? Wrench : isSlot ? TicketCheck : Bell;

  // Créneau : plus aucune heure à proposer (le créneau actuel est déjà le plus
  // tôt possible, ou il est trop tard). Une alerte posée reste, elle, affichée.
  if (isSlot && slotValue == null && !active) {
    return <AlertNotice>{t("slotNothingEarlier")}</AlertNotice>;
  }

  // ————— Alerte posée : la ligne le dit, et offre de la modifier ou retirer —————
  if (active && !expanded) {
    return (
      <div
        className={cn(ROW, "border-primary/35 bg-primary/10 py-2 pr-1.5")}
      >
        <span className={cn(ICON_TILE, "bg-primary text-primary-foreground")}>
          <BellRing className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {isReopen
              ? t("reopenActive")
              : isSlot
                ? t("slotActiveRow", {
                    time: active.slotBefore
                      ? timeLabel(toMinutes(active.slotBefore))
                      : "",
                  })
                : t("alertActiveRow", { minutes: active.threshold ?? 0 })}
          </span>
          {/* Permission navigateur refusée : l'alerte est enregistrée mais ce
              navigateur ne recevra rien tant que l'utilisateur ne réautorise
              pas les notifications dans les réglages du site. */}
          {push.supported && push.permission === "denied" && (
            <span className="block text-xs text-destructive">
              {t("pushDeniedShort")}
            </span>
          )}
        </span>
        {/* Une alerte de réouverture n'a rien à régler. Une alerte de créneau
            dont l'heure n'est plus proposable non plus. */}
        {!isReopen && !(isSlot && slotValue == null) && (
          <Button variant="ghost" size="sm" onClick={() => setExpanded(true)}>
            {t("alertEdit")}
          </Button>
        )}
        {/* Même corbeille que le fil du profil : bouton fantôme teinté en
            destructif. */}
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
      </div>
    );
  }

  // ————— Repliée : une ligne qui invite au clic —————
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        // Le temps de savoir si une alerte existe : la ligne pourrait se
        // changer en « Alerte active » sous le doigt.
        disabled={loading}
        className={cn(
          ROW,
          "bg-muted/40 transition-colors hover:bg-muted disabled:opacity-60",
        )}
      >
        <span className={cn(ICON_TILE, "bg-primary/15 text-primary")}>
          <ModeIcon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{title}</span>
          <span className="block text-xs text-muted-foreground">
            {!isAuthenticated
              ? t("alertRowSignIn")
              : isReopen
                ? tStatus(currentStatus ?? "closed")
                : isSlot
                  ? t("slotRowPick")
                  : t("alertRowPick")}
          </span>
        </span>
        {loading ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>
    );
  }

  // ————— Dépliée : réglage (ou installation / connexion d'abord) —————
  const dirty = isReopen
    ? !existing || !existing.active
    : isSlot
      ? !existing ||
        !existing.active ||
        existing.slotBefore !== (slotValue != null ? toHhmm(slotValue) : null)
      : !existing || !existing.active || existing.threshold !== threshold;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-muted/40 p-3">
      <div className="flex items-center gap-3">
        <span className={cn(ICON_TILE, "bg-primary/15 text-primary")}>
          <ModeIcon className="size-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setExpanded(false)}
          aria-label={t("close")}
          className="text-muted-foreground"
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Séquence installer/se connecter mutualisée avec les rappels de
          spectacles, ici sans cadre : la carte en tient lieu. */}
      <NotificationGate plain>
        {isReopen ? (
          // Mode RÉOUVERTURE : pas de sélecteur de seuil (il n'y a rien à
          // paramétrer) — l'état constaté, rappelé sur la ligne repliée, suffit.
          <p className="text-sm text-muted-foreground">
            {isStandby ? t("reopenLabel") : t("queueReopenLabel")}
          </p>
        ) : isSlot && slotValue != null ? (
          // Mode CRÉNEAU : l'heure limite, en quarts d'heure avant le créneau
          // que la file propose en ce moment.
          <div className="flex flex-col gap-2">
            <NumberStepper
              value={slotValue}
              onChange={setSlotBefore}
              values={slotChoices}
              format={(v) => t("slotOption", { time: timeLabel(v) })}
              aria-label={t("slotRowPick")}
              className="w-full justify-between"
            />
            <p className="text-center text-xs text-muted-foreground">
              {t("slotHint")}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <NumberStepper
              value={threshold}
              onChange={setThreshold}
              values={ALERT_THRESHOLDS}
              format={(v) => tAlert("thresholdOption", { minutes: v })}
              aria-label={tAlert("thresholdLabel")}
              className="w-full justify-between"
            />
            <p className="text-center text-xs text-muted-foreground">
              {t("alertThresholdHint")}
            </p>
          </div>
        )}

        {push.supported && push.permission === "denied" && (
          <p className="text-xs text-destructive">{t("pushDenied")}</p>
        )}

        {/* Navigateur sans Web Push (rare, ex. très ancien) : on le dit
            clairement plutôt que de laisser croire que l'alerte sera reçue ici. */}
        {push.ready && !push.supported && (
          <p className="text-xs text-muted-foreground">
            {t("pushUnsupported")}
          </p>
        )}

        <Button
          onClick={save}
          disabled={saving || (!!existing && !dirty)}
          className="w-full"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {existing?.active && !isReopen ? t("update") : t("alertActivate")}
        </Button>
      </NotificationGate>
    </div>
  );
}
