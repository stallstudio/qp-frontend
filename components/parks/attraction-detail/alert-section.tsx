"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  Bell,
  BellRing,
  Download,
  Loader2,
  LogIn,
  Share,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import NumberStepper from "@/components/ui/number-stepper";
import {
  ALERT_THRESHOLDS,
  defaultThresholdForWait,
} from "@/lib/alert-thresholds";
import { useUser } from "@/components/providers/user-provider";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import type { PwaPlatform, PromptInstall } from "@/lib/pwa";
import AuthDialog from "@/components/auth/auth-dialog";
import type { AlertDTO } from "@/types/user";

type AlertSectionProps = {
  rideId: number;
  rideName: string;
  parkIdentifier: string;
  parkName: string;
  // Temps d'attente standby actuel (si disponible/ouvert) : sert à proposer un
  // seuil par défaut « un cran en dessous » pour une nouvelle alerte.
  currentWaitTime?: number;
};

// Alertes de temps d'attente de l'attraction. Disponibles uniquement connecté ;
// sinon on guide l'utilisateur vers l'action à effectuer (installer / se connecter).
//
// Le Web Push marche DANS L'ONGLET sur desktop (Chrome/Edge/Firefox/Safari) et
// sur Android Chrome — aucune installation requise. Le SEUL cas qui l'impose est
// iOS/iPadOS : Safari ne délivre le push que si l'app est ajoutée à l'écran
// d'accueil. On garde donc l'écran d'installation UNIQUEMENT sur mobile non
// installé (iOS par nécessité, Android par choix produit — meilleure UX depuis
// l'app installée) ; sur desktop on va directement au formulaire.
export default function AlertSection(props: AlertSectionProps) {
  const { isStandalone, platform, canPrompt, promptInstall, hydrated } =
    usePwaInstall();
  const { isAuthenticated } = useUser();

  // Tant que la détection client n'a pas eu lieu, on évite d'afficher l'écran
  // « navigateur » (flash en PWA).
  if (!hydrated) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Mobile non installé → écran d'installation. Desktop → on continue.
  if (!isStandalone && platform !== "desktop") {
    return (
      <InstallPrompt
        platform={platform}
        canPrompt={canPrompt}
        promptInstall={promptInstall}
        showAccountNote={!isAuthenticated}
      />
    );
  }

  if (!isAuthenticated) {
    return <SignInPrompt />;
  }

  return <AlertForm {...props} />;
}

// —————————————————————— Navigateur : installer la PWA ——————————————————————

function InstallPrompt({
  platform,
  canPrompt,
  promptInstall,
  showAccountNote,
}: {
  platform: PwaPlatform;
  canPrompt: boolean;
  promptInstall: PromptInstall;
  showAccountNote: boolean;
}) {
  const t = useTranslations("attractionDetail");
  const [installing, setInstalling] = useState(false);

  const doInstall = async () => {
    setInstalling(true);
    await promptInstall();
    setInstalling(false);
  };

  const steps =
    platform === "ios"
      ? t("installIosSteps")
      : platform === "android"
        ? t("installAndroidSteps")
        : t("installDesktopSteps");

  const Icon = platform === "ios" ? Share : Download;

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-4 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-primary/10">
        <Icon className="size-5 text-primary" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{t("installTitle")}</p>
        <p className="text-sm text-muted-foreground">{t("installIntro")}</p>
      </div>
      {canPrompt && platform !== "ios" ? (
        <Button onClick={doInstall} disabled={installing} className="w-full">
          {installing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          {t("installButton")}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">{steps}</p>
      )}
      {showAccountNote && (
        <p className="text-xs text-muted-foreground">
          {t("installAccountNote")}
        </p>
      )}
    </div>
  );
}

// —————————————————————— PWA mais non connecté ——————————————————————

function SignInPrompt() {
  const t = useTranslations("attractionDetail");
  const tUser = useTranslations("userBlock");
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-4 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-primary/10">
        <Bell className="size-5 text-primary" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{t("signInTitle")}</p>
        <p className="text-sm text-muted-foreground">{t("signInIntro")}</p>
      </div>
      <Button onClick={() => setAuthOpen(true)} className="w-full">
        <LogIn className="size-4" />
        {tUser("signIn")}
      </Button>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}

// —————————————————————— PWA + connecté : formulaire complet ——————————————————————

function AlertForm({
  rideId,
  rideName,
  parkIdentifier,
  parkName,
  currentWaitTime,
}: AlertSectionProps) {
  const t = useTranslations("attractionDetail");
  const tAlert = useTranslations("alerts");
  const { refresh } = useUser();
  const push = usePushNotifications();
  // Défaut d'une nouvelle alerte : un cran sous le temps actuel de l'attraction.
  const defaultThreshold = defaultThresholdForWait(currentWaitTime);
  const [threshold, setThreshold] = useState(defaultThreshold);
  const [existing, setExisting] = useState<AlertDTO | null>(null);
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
        setExisting(found);
        if (found) setThreshold(found.threshold);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rideId]);

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
        threshold,
      });
      setExisting(data);
      refresh();

      // L'alerte est enregistrée quoi qu'il arrive ; on prévient juste si ce
      // navigateur ne pourra pas recevoir les push (permission refusée / non
      // supportée) — d'autres appareils de l'utilisateur le peuvent.
      if (push.supported && !pushOk) {
        toast.warning(t("pushBlocked"));
      } else {
        toast.success(t("saved"));
      }
    } catch {
      toast.error(tAlert("createError"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/user/alerts/${existing.id}`);
      setExisting(null);
      setThreshold(defaultThreshold);
      toast.success(t("deleted"));
      refresh();
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

  // « dirty » autorise l'enregistrement : nouvelle alerte, seuil modifié, ou
  // alerte existante désactivée (le POST la réactive).
  const dirty =
    !existing || !existing.active || existing.threshold !== threshold;

  return (
    <div className="flex flex-col items-center gap-3">
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

      {existing?.active && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          <BellRing className="size-3.5" />
          {t("notifActive")}
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
          {existing ? t("update") : t("save")}
        </Button>
        {existing && (
          <Button
            variant="outline"
            size="icon"
            onClick={remove}
            disabled={deleting}
            aria-label={t("delete")}
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
