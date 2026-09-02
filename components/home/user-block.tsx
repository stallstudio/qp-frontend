"use client";

import { useState } from "react";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { LogIn, LogOut, User as UserIcon } from "lucide-react";
import { useUser } from "@/components/providers/user-provider";
import AuthDialog from "@/components/auth/auth-dialog";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

// Largeur max du libellé (prénom ou « Se connecter ») quand la bannière est
// étendue ; il se rétracte jusqu'à disparaître quand elle se replie.
const LABEL_MAX_WIDTH = 150;

/**
 * Pastille « compte », posée en surimpression dans le coin haut droit de la
 * bannière de l'accueil (rendue par components/home/header.tsx).
 *
 * `progress` est la progression de repli de la bannière (0 = étendue,
 * 1 = repliée) : le libellé se rétracte avec elle — au même rythme que les
 * détails des bannières de parc —, ne laissant que l'avatar et les actions.
 * Verre dépoli sombre repris de l'étoile favori des pages parc (`bg-black/25`,
 * `backdrop-blur-sm`), pour un même poids visuel sur l'image.
 */
export default function UserBlock({ progress = 0 }: { progress?: number }) {
  const t = useTranslations("userBlock");
  const { status, isAuthenticated, profile } = useUser();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Même courbe que `detailsOpacity` des bannières de parc.
  const labelScale = clamp01(1 - progress * 1.6);
  const labelStyle = {
    maxWidth: LABEL_MAX_WIDTH * labelScale,
    opacity: labelScale,
  };

  // Pendant le chargement de la session : rien, pour éviter tout flash. La
  // pastille est en surimpression, elle ne décale aucun contenu.
  if (status === "loading") return null;

  const pillClassName =
    "flex h-8 items-center rounded-full bg-black/25 text-white shadow-sm backdrop-blur-sm transition-colors";

  if (!isAuthenticated) {
    return (
      <>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          aria-label={t("signIn")}
          className={`${pillClassName} cursor-pointer gap-1.5 px-2.5 text-sm font-medium hover:bg-black/35`}
        >
          <LogIn className="size-4 shrink-0" />
          <span className="truncate" style={labelStyle}>
            {t("signIn")}
          </span>
        </button>
        <AuthDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </>
    );
  }

  const displayName = profile?.name || profile?.email || t("account");

  return (
    <div className={`${pillClassName} gap-1 p-1`}>
      <Link
        href="/profile"
        aria-label={t("profile")}
        className="flex min-w-0 items-center rounded-full transition-colors hover:bg-white/15"
        style={{ paddingRight: 8 * labelScale }}
      >
        {profile?.image ? (
          <Image
            src={profile.image}
            alt=""
            width={24}
            height={24}
            className="size-6 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15">
            <UserIcon className="size-3.5" />
          </span>
        )}
        <span
          className="truncate text-sm font-medium"
          style={{ ...labelStyle, marginLeft: 8 * labelScale }}
        >
          {displayName}
        </span>
      </Link>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        aria-label={t("signOut")}
        title={t("signOut")}
        className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-red-500/25 hover:text-red-200"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}
