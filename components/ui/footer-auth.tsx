"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { LogIn, User as UserIcon } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Button, buttonVariants } from "@/components/ui/button";
import { useUser } from "@/components/providers/user-provider";
import AuthDialog from "@/components/auth/auth-dialog";

// Accès compte dans le footer (à côté du sélecteur de langue), sur toutes les
// pages. Connecté : lien vers le profil (avatar + « Profil »). Sinon : un unique
// bouton d'auth (connexion = inscription, même flux) ouvrant la modale.
export default function FooterAuth() {
  const t = useTranslations("userBlock");
  const { status, isAuthenticated, profile } = useUser();
  const [authOpen, setAuthOpen] = useState(false);

  // Pendant le chargement de la session : rien, pour éviter tout flash/décalage.
  if (status === "loading") return null;

  if (isAuthenticated) {
    return (
      <Link
        href="/profile"
        className={buttonVariants({ variant: "secondary" })}
        aria-label={t("profile")}
      >
        {profile?.image ? (
          <Image
            src={profile.image}
            alt=""
            width={20}
            height={20}
            className="size-5 shrink-0 rounded-full object-cover"
          />
        ) : (
          <UserIcon className="size-4" />
        )}
        {t("profile")}
      </Link>
    );
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setAuthOpen(true)}>
        <LogIn className="size-4" />
        {t("signIn")}
      </Button>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
}
