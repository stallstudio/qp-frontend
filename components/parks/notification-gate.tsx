"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, Download, Loader2, LogIn, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/components/providers/user-provider";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import type { PwaPlatform, PromptInstall } from "@/lib/pwa";
import AuthDialog from "@/components/auth/auth-dialog";

// Garde COMMUN aux sections de notifications (alertes de temps d'attente ET
// rappels de spectacles) : gère la séquence « installer la PWA (mobile non
// installé) → se connecter → contenu ». Les notifications Web Push marchent dans
// l'onglet sur desktop/Android sans installation ; seul iOS l'impose (Safari ne
// délivre le push qu'en PWA), d'où l'écran d'installation UNIQUEMENT sur mobile
// non installé.
export default function NotificationGate({
  children,
  signInIntro,
  plain = false,
}: {
  children: React.ReactNode;
  // Intro affichée dans l'écran « se connecter » (contexte : alerte vs rappel).
  // Repli sur le texte des alertes d'attraction.
  signInIntro?: string;
  // Sans cadre ni pastille d'icône : le garde est posé DANS une carte qui porte
  // déjà les deux (la carte d'alerte dépliée du popup attraction).
  plain?: boolean;
}) {
  const { isStandalone, platform, canPrompt, promptInstall, hydrated } =
    usePwaInstall();
  const { isAuthenticated } = useUser();

  // Tant que la détection client n'a pas eu lieu, on évite le flash « navigateur ».
  if (!hydrated) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isStandalone && platform !== "desktop") {
    return (
      <InstallPrompt
        platform={platform}
        canPrompt={canPrompt}
        promptInstall={promptInstall}
        showAccountNote={!isAuthenticated}
        plain={plain}
      />
    );
  }

  if (!isAuthenticated) {
    return <SignInPrompt intro={signInIntro} plain={plain} />;
  }

  return <>{children}</>;
}

const GATE_FRAMED =
  "flex flex-col items-center gap-3 rounded-lg border border-dashed p-4 text-center";
const GATE_PLAIN = "flex flex-col gap-3";

// —————————————————————— Navigateur : installer la PWA ——————————————————————

function InstallPrompt({
  platform,
  canPrompt,
  promptInstall,
  showAccountNote,
  plain,
}: {
  platform: PwaPlatform;
  canPrompt: boolean;
  promptInstall: PromptInstall;
  showAccountNote: boolean;
  plain: boolean;
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
    <div className={plain ? GATE_PLAIN : GATE_FRAMED}>
      {!plain && (
        <div className="flex size-11 items-center justify-center rounded-full bg-primary/10">
          <Icon className="size-5 text-primary" />
        </div>
      )}
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

function SignInPrompt({ intro, plain }: { intro?: string; plain: boolean }) {
  const t = useTranslations("attractionDetail");
  const tUser = useTranslations("userBlock");
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <div className={plain ? GATE_PLAIN : GATE_FRAMED}>
      {!plain && (
        <div className="flex size-11 items-center justify-center rounded-full bg-primary/10">
          <Bell className="size-5 text-primary" />
        </div>
      )}
      <div className="space-y-1">
        {/* En carte, le titre de la carte dit déjà de quoi il s'agit. */}
        {!plain && <p className="font-medium">{t("signInTitle")}</p>}
        <p className="text-sm text-muted-foreground">
          {intro ?? t("signInIntro")}
        </p>
      </div>
      <Button onClick={() => setAuthOpen(true)} className="w-full">
        <LogIn className="size-4" />
        {tUser("signIn")}
      </Button>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
