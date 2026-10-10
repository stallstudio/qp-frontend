"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "motion/react";
import {
  ArrowRight,
  BookOpenText,
  CalendarClock,
  ChevronDown,
  Ghost,
  LayoutGrid,
  LineChart,
  type LucideIcon,
  PanelTop,
  Sparkles,
  Star,
  TicketCheck,
  Timer,
  X,
} from "lucide-react";

import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import LanguageSwitcher from "@/components/ui/language-switcher";
import {
  DetailScene,
  FinaleScene,
  ForecastScene,
  HalloweenScene,
  HeroScene,
  HoursScene,
  ParkScene,
  QueuesScene,
  SceneActivity,
} from "./scenes";

// ————————————————————————————————————————————————————————————————————————
// LE CONTENU DE L'ANNONCE DE VERSION
//
// Séparé du dialog (`whats-new-dialog.tsx`) pour être CHARGÉ À L'OUVERTURE :
// ses scènes rendent les vrais composants de la page d'un parc, graphique
// compris. Importé directement, tout ce code serait parti dans le JavaScript de
// chaque page du site, pour une annonce que chacun ne voit qu'une fois.
//
// Voir le dialog pour l'ordre des nouveautés et les règles d'ouverture.
// ————————————————————————————————————————————————————————————————————————

type Feature = {
  id: string;
  scene: () => React.JSX.Element;
  icon: LucideIcon;
  /** Mention posée à côté du titre (`badges.*`). */
  badge?: "beta";
  /** Puces détaillant la nouveauté (`slides.<id>.points.<key>`). */
  points?: { key: string; icon: LucideIcon }[];
  /**
   * Hauteur de la scène, classe ENTIÈRE (Tailwind ne voit pas les classes
   * fabriquées) : chacune tient les vrais composants qu'elle montre.
   */
  height: string;
};

const FEATURES: Feature[] = [
  {
    id: "park",
    scene: ParkScene,
    icon: LayoutGrid,
    height: "h-60",
    points: [
      { key: "menu", icon: BookOpenText },
      { key: "favorites", icon: Star },
      { key: "wait", icon: Timer },
    ],
  },
  { id: "hours", scene: HoursScene, icon: CalendarClock, height: "h-64" },
  { id: "detail", scene: DetailScene, icon: PanelTop, height: "h-68" },
  { id: "queues", scene: QueuesScene, icon: TicketCheck, height: "h-68" },
  { id: "forecast", scene: ForecastScene, icon: LineChart, height: "h-60" },
  { id: "halloween", scene: HalloweenScene, icon: Ghost, height: "h-64" },
];

/* ————————————————————————————————————————————————————————————————————————
   Le contenu, séparé du dialog pour n'exister QUE tant qu'il est ouvert : les
   scènes ne tournent jamais dans le vide, et la lecture repart du haut à chaque
   ouverture.
   ———————————————————————————————————————————————————————————————————————— */

export default function WhatsNewBody({
  onClose,
}: {
  onClose: () => void;
}) {
  const t = useTranslations("whatsNew");
  const reduceMotion = useReducedMotion();

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
}: {
  feature: Feature;
  /** La première carte est visible d'emblée : sa scène démarre sans attendre. */
  first: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const t = useTranslations("whatsNew");
  const reduceMotion = useReducedMotion();

  // ⚠️ Deux repères DIFFÉRENTS, d'où deux observateurs.
  //   • `near` (marge large) monte la scène AVANT qu'on l'atteigne, et la fige
  //     dès qu'on s'en éloigne : six décors qui dérivent en même temps, c'est
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
        className={cn("relative -mb-px bg-card", feature.height)}
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

      </div>
    </motion.section>
  );
}
