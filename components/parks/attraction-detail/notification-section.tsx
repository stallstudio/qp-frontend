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
import { useUser } from "@/components/providers/user-provider";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import type { PwaPlatform, PromptInstall } from "@/lib/pwa";
import AuthDialog from "@/components/auth/auth-dialog";
import type { NotificationDTO } from "@/types/user";

type NotificationSectionProps = {
  rideId: number;
  rideName: string;
  parkIdentifier: string;
  parkName: string;
};

const DEFAULT_THRESHOLD = 20;
const MIN_THRESHOLD = 5;
const MAX_THRESHOLD = 120;
const THRESHOLD_STEP = 5;

// Notifications de l'attraction. Disponibles uniquement en PWA installée ET
// connecté ; sinon on guide l'utilisateur vers l'action à effectuer (installer /
// se connecter). Couvre les 4 cas de la matrice PWA × authentification.
export default function NotificationSection(props: NotificationSectionProps) {
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

  if (!isStandalone) {
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

  return <NotificationForm {...props} />;
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
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} mode="signin" />
    </div>
  );
}

// —————————————————————— PWA + connecté : formulaire complet ——————————————————————

function NotificationForm({
  rideId,
  rideName,
  parkIdentifier,
  parkName,
}: NotificationSectionProps) {
  const t = useTranslations("attractionDetail");
  const tNotif = useTranslations("notifications");
  const { refresh } = useUser();
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [existing, setExisting] = useState<NotificationDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Charge la notification existante de cette attraction (pré-remplit le seuil).
  useEffect(() => {
    let cancelled = false;
    axios
      .get<NotificationDTO[]>("/api/user/notifications")
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
      const { data } = await axios.post<NotificationDTO>(
        "/api/user/notifications",
        { rideId, rideName, parkIdentifier, parkName, threshold },
      );
      setExisting(data);
      toast.success(t("saved"));
      refresh();
    } catch {
      toast.error(tNotif("createError"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/user/notifications/${existing.id}`);
      setExisting(null);
      setThreshold(DEFAULT_THRESHOLD);
      toast.success(t("deleted"));
      refresh();
    } catch {
      toast.error(tNotif("createError"));
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

  // « dirty » autorise l'enregistrement : nouvelle notif, seuil modifié, ou
  // notif existante désactivée (le POST la réactive).
  const dirty =
    !existing || !existing.active || existing.threshold !== threshold;

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-center text-sm font-medium">
        {tNotif("thresholdLabel")}
      </span>
      <NumberStepper
        value={threshold}
        onChange={setThreshold}
        min={MIN_THRESHOLD}
        max={MAX_THRESHOLD}
        step={THRESHOLD_STEP}
        format={(v) => tNotif("thresholdOption", { minutes: v })}
        aria-label={tNotif("thresholdLabel")}
      />

      {existing?.active && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          <BellRing className="size-3.5" />
          {t("notifActive")}
        </span>
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
