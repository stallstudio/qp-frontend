"use client";

import { useState } from "react";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { LogIn, LogOut, User as UserIcon, UserPlus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useUser } from "@/components/providers/user-provider";
import AuthDialog, { type AuthMode } from "@/components/auth/auth-dialog";

// Bloc utilisateur affiché en tête de l'accueil (au-dessus des parcs favoris).
// Design discret : une carte pleine largeur, contenu adapté à l'état de connexion.
export default function UserBlock() {
  const t = useTranslations("userBlock");
  const { status, isAuthenticated, profile } = useUser();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signin");

  const openAuth = (nextMode: AuthMode) => {
    setMode(nextMode);
    setDialogOpen(true);
  };

  // Pendant le chargement de la session : rien, pour éviter tout flash.
  if (status === "loading") return null;

  if (!isAuthenticated) {
    return (
      <>
        <Card className="flex-row items-center justify-between gap-4 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
              <UserIcon className="size-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-medium">{t("loggedOutTitle")}</p>
              <p className="truncate text-sm text-muted-foreground">
                {t("loggedOutSubtitle")}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openAuth("signin")}
            >
              <LogIn className="size-4" />
              <span className="hidden sm:inline">{t("signIn")}</span>
            </Button>
            <Button size="sm" onClick={() => openAuth("signup")}>
              <UserPlus className="size-4" />
              <span className="hidden sm:inline">{t("signUp")}</span>
            </Button>
          </div>
        </Card>
        <AuthDialog open={dialogOpen} onOpenChange={setDialogOpen} mode={mode} />
      </>
    );
  }

  const displayName = profile?.name || profile?.email || t("account");

  return (
    <Card className="flex-row items-center justify-between gap-4 px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        {profile?.image ? (
          <Image
            src={profile.image}
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <UserIcon className="size-5 text-primary" />
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-medium">{displayName}</p>
          <p className="truncate text-sm text-muted-foreground">
            {t("welcomeBack")}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/profile">
            <Settings className="size-4" />
            <span className="hidden sm:inline">{t("profile")}</span>
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/" })}
          aria-label={t("signOut")}
        >
          <LogOut className="size-4" />
          <span className="hidden sm:inline">{t("signOut")}</span>
        </Button>
      </div>
    </Card>
  );
}
