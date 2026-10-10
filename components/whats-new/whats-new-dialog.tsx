"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import { usePathname } from "@/i18n/routing";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { CONSENT_EVENT, readConsent } from "@/lib/cookie-consent";
import {
  hasSeenWhatsNew,
  isWhatsNewExpired,
  markWhatsNewSeen,
} from "@/lib/whats-new";
import { SceneBanners } from "./scene-frame";
import type { WhatsNewBanners } from "./banners";

const loadBody = () => import("./whats-new-body");

// Le contenu, chargé à la demande (voir plus bas). Le temps du chargement, un
// rond à la hauteur de l'ouverture, pour que le dialog ne s'ouvre pas sur un
// trait.
const WhatsNewBody = dynamic(loadBody, {
  ssr: false,
  loading: () => (
    <div className="flex h-72 items-center justify-center text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
    </div>
  ),
});

// ————————————————————————————————————————————————————————————————————————
// L'ANNONCE DE VERSION (v4 depuis le 2026-10-09)
//
// Une page qui se déroule : une ouverture, les nouveautés en cartes, une
// clôture. Chacune est illustrée par une scène animée qui montre l'interface
// RÉELLE, en plus petit (`scenes.tsx`), pour qu'on reconnaisse la
// fonctionnalité quand on tombera dessus.
//
// ⚠️ **Le contenu vit dans `whats-new-body.tsx`, chargé à l'ouverture** : ses
// scènes tirent les listes et le graphique de la page d'un parc. Ce module-ci,
// monté dans le layout de toutes les pages, ne garde que la décision d'ouvrir.
//
// ⚠️ **Ça se FAIT DÉFILER, ça ne se clique pas.** Une première version
// enchaînait neuf écrans avec « Suivant » : chaque clic est une occasion
// d'abandonner, et rien ne dit jamais combien il en reste. Ici tout est là d'un
// coup, le bouton de sortie reste sous le pouce du début à la fin, et le filet
// de progression en haut dit ce qui reste — personne n'est retenu.
//
// ⚠️ **L'ORDRE est celui de l'utilité, pas celui du développement.** Le parc
// entier d'abord — restaurants et boutiques, ce que tout le monde verra dès la
// première page de parc ; ses horaires ensuite ; puis la fiche et ses files ;
// les prévisions et Halloween, qui ne concernent qu'une partie des parcs, en
// dernier.
//
// ⚠️ **Les nouveautés MAJEURES seulement.** Pas de correctif, pas de retouche
// d'affichage : une annonce qui liste tout n'est lue par personne. Les favoris
// et les alertes des restaurants, par exemple, sont des puces de la première
// carte, pas une carte à eux.
//
// ⚠️ **Une seule fois, et jamais deux.** Toute sortie — bouton, croix, Échap,
// clic hors du dialog — vaut « lu » (`lib/whats-new.ts`).
//
// ⚠️ **Après le bandeau cookies, pas devant.** Le consentement est une décision
// qu'on doit pouvoir prendre sans qu'un voile la recouvre : l'annonce attend
// donc qu'un choix ait été fait, et s'ouvre juste après.
// ————————————————————————————————————————————————————————————————————————

// Laisse la page se peindre avant de la recouvrir : arriver sur un site déjà
// masqué donne l'impression d'une publicité, arriver dessus puis voir le voile
// se poser donne celle d'un message.
const OPEN_DELAY_MS = 700;

// Pages où l'annonce ne s'invite pas : un compte qu'on vient de rejoindre par
// lien e-mail, et les pages légales qu'on ouvre pour une raison précise.
const EXCLUDED_PATHS = ["/profile", "/privacy", "/legal-notice", "/cookies"];

// `?whatsnew=1` rouvre l'annonce quoi qu'il arrive : déjà vue, date passée, page
// exclue. Sert à la relire, à la faire relire, et à travailler dessus sans vider
// son stockage à chaque rechargement.
const FORCE_PARAM = "whatsnew";

/**
 * `banners` vient du LAYOUT, donc du serveur : les vraies photos des popups des
 * scènes portent une signature que le navigateur ne sait pas produire
 * (`banners.ts`). `null` — un appel sans la prop — laisse la photo de repli.
 */
export default function WhatsNewDialog({
  banners = null,
}: {
  banners?: WhatsNewBanners | null;
}) {
  const t = useTranslations("whatsNew");
  const pathname = usePathname();

  const [open, setOpen] = useState(false);

  const eligible = useMemo(
    () => !EXCLUDED_PATHS.some((path) => pathname.startsWith(path)),
    [pathname],
  );

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has(FORCE_PARAM)) {
      setOpen(true);
      return;
    }

    if (!eligible || isWhatsNewExpired() || hasSeenWhatsNew()) return;

    let timer: ReturnType<typeof setTimeout> | undefined;

    const openIfConsentSettled = () => {
      if (readConsent() === null) return false;
      // Le contenu se charge pendant le délai d'ouverture : le dialog s'ouvre
      // en général sur ses scènes, pas sur le rond d'attente.
      void loadBody();
      timer = setTimeout(() => setOpen(true), OPEN_DELAY_MS);
      return true;
    };

    if (openIfConsentSettled()) return () => clearTimeout(timer);

    const onConsent = () => {
      if (openIfConsentSettled()) {
        window.removeEventListener(CONSENT_EVENT, onConsent);
      }
    };
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => {
      window.removeEventListener(CONSENT_EVENT, onConsent);
      clearTimeout(timer);
    };
  }, [eligible]);

  const close = useCallback(() => {
    markWhatsNewSeen();
    setOpen(false);
  }, []);

  return (
    <SceneBanners value={banners}>
      <Dialog open={open} onOpenChange={(next) => !next && close()}>
        <DialogContent
          showCloseButton={false}
          // `gap-0` et `p-0` : les scènes doivent toucher les bords, c'est ce qui
          // fait l'effet. Le rembourrage est repris par chaque bloc.
          className="flex max-h-[88dvh] flex-col gap-0 overflow-hidden rounded-3xl border-0 p-0 shadow-2xl sm:max-w-lg"
        >
          <DialogTitle className="sr-only">{t("srTitle")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("srDescription")}
          </DialogDescription>

          <WhatsNewBody onClose={close} />
        </DialogContent>
      </Dialog>
    </SceneBanners>
  );
}
