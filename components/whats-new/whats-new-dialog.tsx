"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "motion/react";
import {
  ArrowRight,
  BellRing,
  ChevronDown,
  CloudSun,
  Download,
  Eye,
  LineChart,
  type LucideIcon,
  RotateCcw,
  Sparkles,
  Star,
  Timer,
  UserRound,
  X,
} from "lucide-react";

import { Link, usePathname } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import LanguageSwitcher from "@/components/ui/language-switcher";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { CONSENT_EVENT, readConsent } from "@/lib/cookie-consent";
import {
  hasSeenWhatsNew,
  isWhatsNewExpired,
  markWhatsNewSeen,
} from "@/lib/whats-new";
import {
  AccountScene,
  DetailScene,
  EventsScene,
  FavoritesScene,
  FinaleScene,
  ForecastScene,
  HeroScene,
  NotificationsScene,
  SceneActivity,
  WeatherScene,
} from "./scenes";
import { SceneBanners } from "./scene-frame";
import type { WhatsNewBanners } from "./banners";

// ————————————————————————————————————————————————————————————————————————
// L'ANNONCE DE LA V3
//
// Une page qui se déroule : une ouverture, les sept nouveautés en cartes, une
// clôture. Chacune est illustrée par une scène animée qui MIME l'interface
// réelle (`scenes.tsx`), pour qu'on reconnaisse la fonctionnalité quand on
// tombera dessus.
//
// ⚠️ **Ça se FAIT DÉFILER, ça ne se clique pas.** Une première version
// enchaînait neuf écrans avec « Suivant » : chaque clic est une occasion
// d'abandonner, et rien ne dit jamais combien il en reste. Ici tout est là d'un
// coup, le bouton de sortie reste sous le pouce du début à la fin, et le filet
// de progression en haut dit ce qui reste — personne n'est retenu.
//
// ⚠️ **L'ORDRE est celui de l'utilité, pas celui du développement.** Le compte
// d'abord, parce que tout le reste en dépend (favoris synchronisés, alertes,
// rappels) ; les notifications ensuite, parce que c'est ce qui change vraiment
// une journée au parc ; le décor (événements, météo) en dernier.
//
// ⚠️ **Une seule fois, et jamais deux.** Toute sortie — bouton, croix, Échap,
// clic hors du dialog — vaut « lu » (`lib/whats-new.ts`).
//
// ⚠️ **Après le bandeau cookies, pas devant.** Le consentement est une décision
// qu'on doit pouvoir prendre sans qu'un voile la recouvre : l'annonce attend
// donc qu'un choix ait été fait, et s'ouvre juste après.
// ————————————————————————————————————————————————————————————————————————

type Feature = {
  id: string;
  scene: () => React.JSX.Element;
  icon: LucideIcon;
  /** Mention posée à côté du titre (`badges.*`). */
  badge?: "beta";
  /** Puces détaillant la nouveauté (`slides.<id>.points.<key>`). */
  points?: { key: string; icon: LucideIcon }[];
};

const FEATURES: Feature[] = [
  { id: "account", scene: AccountScene, icon: UserRound },
  { id: "favorites", scene: FavoritesScene, icon: Star },
  {
    id: "notifications",
    scene: NotificationsScene,
    icon: BellRing,
    points: [
      { key: "threshold", icon: Timer },
      { key: "reopened", icon: RotateCcw },
      { key: "show", icon: Sparkles },
    ],
  },
  { id: "forecast", scene: ForecastScene, icon: LineChart, badge: "beta" },
  { id: "detail", scene: DetailScene, icon: Eye },
  { id: "events", scene: EventsScene, icon: Sparkles },
  { id: "weather", scene: WeatherScene, icon: CloudSun },
];

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
 * `banners` vient du LAYOUT, donc du serveur : les deux vraies photos des scènes
 * portent une signature que le navigateur ne sait pas produire (`banners.ts`).
 * `null` — un appel sans la prop — laisse les scènes sur la photo de repli.
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

/* ————————————————————————————————————————————————————————————————————————
   Le contenu, séparé du dialog pour n'exister QUE tant qu'il est ouvert : les
   scènes ne tournent jamais dans le vide, et la lecture repart du haut à chaque
   ouverture.
   ———————————————————————————————————————————————————————————————————————— */

function WhatsNewBody({ onClose }: { onClose: () => void }) {
  const t = useTranslations("whatsNew");
  const reduceMotion = useReducedMotion();
  const { canPrompt, promptInstall, isStandalone, hydrated } = usePwaInstall();

  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ container: scrollRef });
  const [started, setStarted] = useState(false);

  // L'invite à faire défiler ne sert qu'avant le premier geste.
  useMotionValueEvent(scrollYProgress, "change", (value) => {
    if (value > 0.01) setStarted(true);
  });

  return (
    <>
      {/* Avancement dans la page, en filet posé tout en haut : on voit ce qu'il
          reste sans qu'on ait à le dire. */}
      <motion.div
        aria-hidden
        className="absolute inset-x-0 top-0 z-20 h-0.5 origin-left bg-primary"
        style={{ scaleX: scrollYProgress }}
      />

      <button
        type="button"
        onClick={onClose}
        aria-label={t("nav.close")}
        className="absolute right-3 top-3 z-20 flex size-8 cursor-pointer items-center justify-center rounded-full bg-background/70 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background hover:text-foreground"
      >
        <X className="size-4" />
      </button>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain"
      >
        {/* ————————————————————— Ouverture —————————————————————
            `-mb-px` : sans ce chevauchement d'un pixel, le dialog étant centré
            par `translate(-50%)`, sa hauteur tombe sur un demi-pixel et une
            couture apparaît, par où la page transparaît. */}
        <div className="relative -mb-px h-52 bg-background">
          <SceneActivity>
            <HeroScene />
          </SceneActivity>
        </div>

        <div className="relative px-6 pb-7 pt-1 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" />
            {t("hero.eyebrow", { count: FEATURES.length })}
          </span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-balance">
            {t("hero.title")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
            {t("hero.body")}
          </p>

          <motion.span
            aria-hidden
            className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground/70"
            animate={
              started
                ? { opacity: 0, y: -4 }
                : reduceMotion
                  ? { opacity: 1 }
                  : { opacity: 1, y: [0, 4, 0] }
            }
            transition={
              started
                ? { duration: 0.25 }
                : { duration: 2, repeat: Infinity, ease: "easeInOut" }
            }
          >
            {t("nav.scrollHint")}
            <ChevronDown className="size-3.5" />
          </motion.span>
        </div>

        {/* ————————————————————— Les nouveautés ————————————————————— */}
        <div className="flex flex-col gap-3 px-3 pb-6 sm:px-4">
          {FEATURES.map((feature, position) => (
            <FeatureCard
              key={feature.id}
              feature={feature}
              first={position === 0}
              scrollRef={scrollRef}
              showInstall={
                feature.id === "notifications" &&
                hydrated &&
                !isStandalone &&
                canPrompt
              }
              onInstall={promptInstall}
            />
          ))}
        </div>

        {/* ————————————————————— Clôture ————————————————————— */}
        <div className="relative -mb-px h-36 bg-background">
          <SceneActivity>
            <FinaleScene />
          </SceneActivity>
        </div>
        <div className="relative px-6 pb-8 pt-1 text-center">
          <h3 className="text-lg font-bold tracking-tight">
            {t("finale.title")}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
            {t("finale.body")}
          </p>
          <Link
            href="/about"
            onClick={onClose}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {t("finale.aboutLink")}
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>

      {/* ————————————————————— La barre d'actions —————————————————————
          Collée en bas, visible dès la première seconde : on peut sortir sans
          avoir à parcourir quoi que ce soit. */}
      <div className="flex shrink-0 items-center gap-2 border-t bg-card px-4 py-3">
        <LanguageSwitcher showText={false} />
        <Button onClick={onClose} className="flex-1">
          {t("nav.finish")}
          <ArrowRight />
        </Button>
      </div>
    </>
  );
}

/* ————————————————————————————————————————————————————————————————————————
   Une nouveauté : sa scène, son titre, son texte.
   ———————————————————————————————————————————————————————————————————————— */

function FeatureCard({
  feature,
  first,
  scrollRef,
  showInstall,
  onInstall,
}: {
  feature: Feature;
  /** La première carte est visible d'emblée : sa scène démarre sans attendre. */
  first: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  showInstall: boolean;
  onInstall: () => Promise<unknown>;
}) {
  const t = useTranslations("whatsNew");
  const reduceMotion = useReducedMotion();
  const [installing, setInstalling] = useState(false);

  // ⚠️ Deux repères DIFFÉRENTS, d'où deux observateurs.
  //   • `near` (marge large) monte la scène AVANT qu'on l'atteigne, et la fige
  //     dès qu'on s'en éloigne : sept décors qui dérivent en même temps, c'est
  //     du travail continu pour rien sur un téléphone. Monter au dernier moment
  //     a un second effet, plus important : les animations d'entrée (le tracé
  //     de la courbe, l'ouverture de la fiche) se jouent quand on ARRIVE
  //     dessus, au lieu d'avoir déjà eu lieu, invisibles, à l'ouverture.
  //   • L'entrée de la carte elle-même se déclenche quand elle est vraiment là.
  const [near, setNear] = useState(first);
  const [everNear, setEverNear] = useState(first);

  const Scene = feature.scene;
  const Icon = feature.icon;

  return (
    <motion.section
      className="overflow-hidden rounded-2xl border bg-card"
      initial={reduceMotion ? false : { opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      // `root` : le défilement a lieu DANS le dialog, pas dans la fenêtre.
      // `once` : une carte déjà apparue ne rejoue pas son entrée si on remonte.
      viewport={{ root: scrollRef, once: true, amount: 0.15 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="relative -mb-px h-40 bg-card"
        viewport={{ root: scrollRef, margin: "240px 0px 240px 0px" }}
        onViewportEnter={() => {
          setNear(true);
          setEverNear(true);
        }}
        onViewportLeave={() => setNear(false)}
      >
        {everNear && (
          <SceneActivity active={near} surface="card">
            <Scene />
          </SceneActivity>
        )}
      </motion.div>

      <div className="relative p-4 pt-2">
        <div className="mb-2 flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-4.5" />
          </span>
          <h3 className="text-base font-semibold leading-tight tracking-tight text-balance">
            {t(`slides.${feature.id}.title`)}
          </h3>
          {feature.badge && (
            <span className="ms-auto shrink-0 self-start rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
              {t(`badges.${feature.badge}`)}
            </span>
          )}
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          {t(`slides.${feature.id}.body`)}
        </p>

        {feature.points && (
          <ul className="mt-3 space-y-2">
            {feature.points.map((point) => (
              <li key={point.key} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <point.icon className="size-3" />
                </span>
                <span className="text-pretty">
                  {t(`slides.${feature.id}.points.${point.key}`)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Le seul geste possible depuis l'annonce : installer l'application, et
            uniquement là où le navigateur nous laisse la proposer. Sur iOS,
            l'installation passe par le menu de partage : elle est expliquée au
            bon endroit (la fiche d'une attraction), pas ici. */}
        {showInstall && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            disabled={installing}
            onClick={async () => {
              setInstalling(true);
              await onInstall();
              setInstalling(false);
            }}
          >
            <Download />
            {t("slides.notifications.install")}
          </Button>
        )}
      </div>
    </motion.section>
  );
}
