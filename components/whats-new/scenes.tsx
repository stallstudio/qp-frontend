"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  BellRing,
  CalendarClock,
  ChevronRight,
  FerrisWheel,
  Ghost,
  LayoutGrid,
  LineChart,
  Radio,
  TicketCheck,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { WHATS_NEW_VERSION } from "@/lib/whats-new";
import { POI_KIND_ICONS, type ParkFamily } from "@/lib/poi-kinds";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FavoritesDemoProvider } from "@/components/providers/favorites-provider";
import { NotificationsDemoProvider } from "@/components/providers/notifications-provider";
import FamilySwitcher from "@/components/parks/family-switcher";
import ParkWaitTimeTable from "@/components/parks/wait-time-table";
import PoiStatusTable from "@/components/parks/poi-status-table";
import PoiHoursTable from "@/components/parks/poi-hours-table";
import EventCard from "@/components/parks/event-card";
import ImageSection from "@/components/parks/attraction-detail/image-section";
import LiveStats, {
  Stat,
  StatTime,
} from "@/components/parks/attraction-detail/live-stats";
import {
  poiFactStats,
  usePoiFacts,
} from "@/components/parks/attraction-detail/poi-facts";
import ChartSection from "@/components/parks/attraction-detail/chart-section";
import { PIXEL_PER_MINUTE } from "@/components/parks/show-time-table/types";
import {
  ALERT_ICON_TILE,
  ALERT_ROW,
} from "@/components/parks/attraction-detail/alert-section";
import {
  CARD_TITLE_KEYS,
  FAMILY_FADE,
  FAMILY_SLIDE,
  TAB_GEOMETRY,
} from "@/components/parks/main-card";
import type { FavoritesPayload } from "@/types/user";
import SceneFrame, {
  SceneActivity,
  useSceneBanners,
  useSceneContext,
} from "./scene-frame";
import {
  BIG_THUNDER_ID,
  DLP,
  DLP_FAVORITES,
  DLP_GRID_START_HOUR,
  DLP_RESTAURANTS,
  DLP_RIDES,
  DLP_SHOPS,
  FRIGHT_NIGHTS_FAVORITES,
  FRIGHT_NIGHTS_HOUSES,
  HYPERSPACE,
  HYPERSPACE_ID,
  SLAUGHTERHOUSE_ID,
  WALIBI_HOLLAND,
  dlpHours,
  frightNights,
  parkToday,
  rangedRideHistory,
} from "./demo-data";

export { SceneActivity };

// ————————————————————————————————————————————————————————————————————————
// LES SCÈNES DE L'ANNONCE DE VERSION
//
// Une par nouveauté. Chacune montre l'interface RÉELLE, en plus petit et
// animée : ce sont les composants mêmes de la page d'un parc — sélecteur de
// familles, listes, grille des horaires, en-tête et bandeau du popup,
// graphique, carte d'événement —, rendus avec les données de `demo-data.ts`.
//
// ⚠️ **Les vrais composants, pas des imitations** (arbitré le 2026-10-10). Une
// première version les redessinait à la main : couleurs, proportions et
// libellés dérivaient aussitôt de ce qu'on trouve sur le site, et une démo qui
// montre un écran que l'application ne produit pas est une promesse qu'elle ne
// tiendra pas. Ici, ce que la scène montre EST ce que le site affiche — et le
// restera quand le site changera.
//
// ⚠️ **Inertes et muettes** : `Miniature` les rend sous `inert` et
// `aria-hidden`. Rien ne s'y clique, rien n'y prend le focus, et ce qu'on y
// voit est toujours dit en toutes lettres dans le corps du dialog.
//
// ⚠️ **Indépendantes du compte de celui qui regarde** : les favoris et les
// alertes y sont FIGÉS (`FavoritesDemoProvider`, `NotificationsDemoProvider`).
// Sans eux, les étoiles d'un visiteur réel s'y seraient mêlées — et aucune
// étoile ne serait apparue pour un visiteur sans compte.
//
// ⚠️ **Chargées à l'ouverture seulement** : ce module tire les listes et le
// graphique de la page d'un parc. L'annonce étant montée dans le layout, il
// passerait sinon dans le JavaScript de TOUTES les pages (voir
// `whats-new-dialog.tsx`).
// ————————————————————————————————————————————————————————————————————————

/**
 * Une scène doit-elle rester IMMOBILE ? Soit le visiteur a demandé moins
 * d'animations, soit elle est hors champ — dans les deux cas, rien ne bouge.
 */
function useStillness(): boolean {
  const reduceMotion = useReducedMotion();
  const { active } = useSceneContext();
  return Boolean(reduceMotion) || !active;
}

/** Boucle sur un index, avec le pas de temps donné. Nettoyée au démontage. */
function useLoop(length: number, intervalMs: number, enabled = true) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!enabled || length <= 1) return;
    const id = setInterval(
      () => setIndex((current) => (current + 1) % length),
      intervalMs,
    );
    return () => clearInterval(id);
  }, [length, intervalMs, enabled]);
  return index;
}

/* ————— La miniature ————— */

// Largeur de rendu des composants, avant réduction.
//
// ⚠️ **Deux largeurs, selon l'écran de celui qui regarde, et c'est forcé** :
// les composants suivent les variantes `sm:` de Tailwind, qui lisent la largeur
// de la FENÊTRE, pas celle de la miniature. Sur un ordinateur, une liste rendue
// à la largeur d'un téléphone prenait les colonnes du bureau dans 420 pixels —
// une mise en page qui n'existe nulle part sur le site, état coupé à droite
// compris. Chacun voit donc la page telle que SON écran l'affiche : celle d'un
// téléphone en dessous de 640 px, celle d'un ordinateur au-delà.
type DesignWidth = { base: number; sm: number };
const LIST_WIDTH: DesignWidth = { base: 380, sm: 600 };
// Le popup : `max-w-[calc(100%-2rem)]` au téléphone, `sm:max-w-md` au-delà.
const POPUP_WIDTH: DesignWidth = { base: 360, sm: 448 };

const SM_QUERY = "(min-width: 640px)";

// Jamais plus grand que ça, même si la place le permet : c'est une vignette.
const MAX_SCALE = 0.78;

// Les 2,5 derniers rem de la scène s'effacent. Ce qu'une scène doit montrer
// (ligne d'alerte, bandeau, phrase de prévision) tient au-dessus : c'est ce
// qui règle la hauteur de chacune (`FEATURES`) et sa réduction (`maxScale`).
const FADE_MASK = "linear-gradient(to bottom, black calc(100% - 2.5rem), transparent)";

/**
 * Rend ses enfants à `width` pixels, réduits pour tenir dans la largeur de la
 * scène, centrés et calés en haut. Le bas déborde volontairement : le fondu du
 * décor (`SceneFrame`) le fait disparaître, comme une page qui continue.
 */
function Miniature({
  width: widths,
  top = 14,
  maxScale = MAX_SCALE,
  children,
}: {
  width: DesignWidth;
  top?: number;
  /**
   * Plus petit que d'ordinaire, quand ce qu'il faut voir est plus haut : la
   * ligne d'alerte sous la photo d'un popup, par exemple.
   */
  maxScale?: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [width, setWidth] = useState(widths.sm);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const media = window.matchMedia(SM_QUERY);
    const measure = () => {
      const design = media.matches ? widths.sm : widths.base;
      setWidth(design);
      setScale(Math.min(maxScale, element.clientWidth / design));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    media.addEventListener("change", measure);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", measure);
    };
  }, [widths, maxScale]);

  return (
    // Le bas s'efface plutôt que d'être coupé net : sans ce fondu, la liste
    // s'arrêtait au ras de la scène, juste au-dessus du titre de la carte.
    <div
      ref={ref}
      className="absolute inset-0 overflow-hidden"
      style={{ maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }}
    >
      <div
        inert
        aria-hidden
        className="pointer-events-none absolute left-1/2 origin-top select-none"
        style={{
          top,
          width,
          transform: `translateX(-50%) scale(${scale ?? maxScale})`,
          // Avant la première mesure, rien : sinon la vignette apparaîtrait à
          // la mauvaise taille, puis sauterait.
          visibility: scale === null ? "hidden" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Les favoris et alertes figés d'une scène. */
function DemoState({
  favorites = {},
  alertQueues = [],
  children,
}: {
  favorites?: Partial<FavoritesPayload>;
  alertQueues?: [number, string][];
  children: React.ReactNode;
}) {
  return (
    <FavoritesDemoProvider favorites={favorites}>
      <NotificationsDemoProvider alertQueues={alertQueues}>
        {children}
      </NotificationsDemoProvider>
    </FavoritesDemoProvider>
  );
}

/**
 * La carte de la liste de la page d'un parc : le sélecteur de familles en
 * tête, et la liste de la famille choisie qui glisse vers sa pastille.
 *
 * ⚠️ Recopie de `renderColumn` (`main-card.tsx`) : mêmes classes, mêmes
 * variantes de glissement. La carte de la page n'est pas un composant à part —
 * c'est le seul morceau de la scène qui ne soit pas le composant lui-même.
 */
function FamilyListCard({
  families,
  family,
  direction,
  children,
}: {
  families: readonly ParkFamily[];
  family: ParkFamily;
  direction: number;
  children: React.ReactNode;
}) {
  const tCards = useTranslations("parkPage.cards");
  const tTabs = useTranslations("tabs");
  const reduceMotion = useReducedMotion();
  const idPrefix = `whats-new-${families.join("-")}`;
  return (
    <Card className="w-full gap-0 rounded-4xl p-2.5 py-0 sm:p-4 sm:py-0">
      <div className="pt-2.5 pb-1 sm:pt-4">
        <FamilySwitcher
          options={families.map((option) => ({
            family: option,
            label: tCards(CARD_TITLE_KEYS[option]),
            icon: POI_KIND_ICONS[option],
          }))}
          value={family}
          onChange={() => {}}
          ariaLabel={tTabs("families")}
          idPrefix={idPrefix}
          panelId={`${idPrefix}-panel`}
        />
      </div>
      <div className="overflow-x-clip pb-2">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={family}
            custom={direction}
            variants={reduceMotion ? FAMILY_FADE : FAMILY_SLIDE}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </Card>
  );
}

/** Le sens du glissement : vers la droite quand la boucle avance. */
function useSlideDirection(index: number): number {
  const previous = useRef(index);
  const direction = index >= previous.current ? 1 : -1;
  useEffect(() => {
    previous.current = index;
  }, [index]);
  return direction;
}

/**
 * La coquille d'un popup de détail : celle du `DialogContent` des popups
 * d'attraction et de POI, avec sa croix — sans le dialog, qui ouvrirait une
 * vraie fenêtre par-dessus l'annonce.
 */
function PopupFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-4xl bg-background shadow-lg">
      {children}
      <span className="absolute top-4 right-4 z-10 opacity-70">
        <X className="size-4 text-white" />
      </span>
    </div>
  );
}

/**
 * La page assombrie et le popup posé dessus, comme un vrai dialog. Rendu
 * par-dessus la liste de la scène, qui reste en place dessous.
 *
 * ⚠️ **Toujours monté, seulement caché** : remonté à chaque boucle, le popup
 * rechargeait sa bannière, et la scène montrait un squelette gris une fois sur
 * deux.
 *
 * ⚠️ Le voile descend aussi bas que le popup (`min-h-full`) : un popup est
 * plus haut que la liste qu'il recouvre, et un voile arrêté au bas de la liste
 * laissait ses lignes du bas sur fond clair.
 */
function PopupOverlay({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      // `z-20` : au-dessus des pastilles d'une carte d'événement, posées en
      // `z-10` dans son en-tête.
      className="absolute inset-x-0 top-0 z-20 min-h-full rounded-4xl bg-black/50 pb-6"
      initial={false}
      animate={{ opacity: open ? 1 : 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* La largeur d'un vrai popup : `sm:max-w-md`, et 2 rem de marge au
          téléphone. */}
      <motion.div
        className="mx-auto mt-6 w-[min(28rem,calc(100%-2rem))]"
        initial={false}
        animate={{ scale: open ? 1 : 0.95 }}
        transition={{ duration: 0.25 }}
      >
        <PopupFrame>{children}</PopupFrame>
      </motion.div>
    </motion.div>
  );
}

/* ========================================================================== */
/* 0. Ouverture — le logo, entouré des nouveautés en orbite                   */
/* ========================================================================== */

const ORBIT_ICONS = [
  LayoutGrid,
  CalendarClock,
  UtensilsCrossed,
  TicketCheck,
  LineChart,
  Ghost,
] as const;

// Orbite ELLIPTIQUE et non circulaire : la scène est deux fois plus large que
// haute, un cercle laisserait ses côtés vides.
//
// ⚠️ **L'ellipse ne TOURNE PAS.** Faire pivoter le conteneur ne fait pas
// voyager les icônes LE LONG de l'ellipse : ça fait tourner l'ellipse
// elle-même, et son grand axe (118 px) finit à la verticale — les icônes
// sortent alors du cadre par le haut. Elles gardent donc leur place et
// respirent chacune à son rythme, ce qui anime la scène sans la déborder.
const ORBIT_RADIUS_X = 118;
const ORBIT_RADIUS_Y = 62;

export function HeroScene() {
  const still = useStillness();

  return (
    <SceneFrame>
      <div className="relative flex size-full items-center justify-center">
        <div className="absolute inset-0">
          {ORBIT_ICONS.map((Icon, index) => {
            const angle = (index / ORBIT_ICONS.length) * Math.PI * 2;
            return (
              <div
                key={index}
                className="absolute left-1/2 top-1/2"
                style={{
                  transform: `translate(-50%, -50%) translate(${
                    Math.cos(angle) * ORBIT_RADIUS_X
                  }px, ${Math.sin(angle) * ORBIT_RADIUS_Y}px)`,
                }}
              >
                <motion.span
                  className="flex size-9 items-center justify-center rounded-2xl border border-border/60 bg-card/80 text-primary shadow-sm backdrop-blur-sm"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={
                    still
                      ? { opacity: 1, scale: 1 }
                      : { opacity: 1, scale: 1, y: [0, -6, 0] }
                  }
                  transition={{
                    opacity: { delay: 0.1 + index * 0.07, duration: 0.35 },
                    scale: {
                      delay: 0.1 + index * 0.07,
                      type: "spring",
                      stiffness: 300,
                      damping: 18,
                    },
                    y: {
                      duration: 3.6,
                      delay: index * 0.45,
                      repeat: Infinity,
                      ease: "easeInOut",
                    },
                  }}
                >
                  <Icon className="size-4" />
                </motion.span>
              </div>
            );
          })}
        </div>

        {/* Halo pulsé derrière le logo. */}
        <motion.div
          className="absolute size-28 rounded-full bg-primary/25 blur-2xl"
          animate={still ? undefined : { scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 18 }}
          className="relative"
        >
          <Image
            src="/web-app-manifest-192x192.png"
            alt=""
            width={192}
            height={192}
            className="size-20 drop-shadow-lg"
            priority
          />
          {/* Pastille de version, posée en débord comme un macaron. */}
          <span className="absolute -bottom-2 -right-3 rounded-full bg-primary px-2.5 py-0.5 text-sm font-extrabold text-primary-foreground shadow-md">
            v{WHATS_NEW_VERSION}
          </span>
        </motion.div>
      </div>
    </SceneFrame>
  );
}

/* ========================================================================== */
/* 1. Tout le parc — Disneyland Paris, d'une famille à l'autre                 */
/* ========================================================================== */

// Les familles de Disneyland Paris en direct, dans l'ordre de leurs pastilles.
const PARK_FAMILIES = ["ride", "restaurant", "shop"] as const;

export function ParkScene() {
  const still = useStillness();
  const loop = useLoop(PARK_FAMILIES.length, 2800, !still);
  // Immobile, la scène s'arrête sur les restaurants : c'est la nouveauté, et
  // Casey’s Corner y est épinglé en favori.
  const index = still ? 1 : loop;
  const family = PARK_FAMILIES[index];
  const direction = useSlideDirection(index);

  return (
    <SceneFrame tint={["bg-restaurant/25", "bg-primary/20", "bg-shop/25"]}>
      <Miniature width={LIST_WIDTH}>
        <DemoState favorites={DLP_FAVORITES}>
          <FamilyListCard
            families={PARK_FAMILIES}
            family={family}
            direction={direction}
          >
            {family === "ride" ? (
              <ParkWaitTimeTable
                waitTimes={DLP_RIDES}
                queueTypeLabels={DLP.queueTypeLabels}
                parkIdentifier={DLP.identifier}
                parkName={DLP.name}
              />
            ) : (
              <PoiStatusTable
                pois={family === "restaurant" ? DLP_RESTAURANTS : DLP_SHOPS}
                kind={family}
                parkIdentifier={DLP.identifier}
                parkName={DLP.name}
              />
            )}
          </FamilyListCard>
        </DemoState>
      </Miniature>
    </SceneFrame>
  );
}

/* ========================================================================== */
/* 2. Les horaires — l'onglet « Horaires du jour » de Disneyland Paris         */
/* ========================================================================== */

// Les familles de l'onglet chez Disneyland Paris, dans l'ordre des pastilles :
// les spectacles aussi, qu'on ne parcourt pas — la scène parle des horaires
// d'ouverture.
const HOURS_PILLS = ["ride", "show", "restaurant", "shop"] as const;
const HOURS_CYCLE = ["restaurant", "shop", "ride"] as const;

// La grille balaie la journée entre ces deux heures (heure du parc) : sans ça,
// elle se cale sur « maintenant », et la nuit, sur le début de matinée, où il
// n'y a presque rien à voir. Le balayage montre au passage l'heure d'une barre
// qui suit le défilement.
const PAN_FROM = 10;
const PAN_TO = 15;
const PAN_STILL = 11;
const PAN_PERIOD_MS = 9000;

/**
 * Fait défiler la grille des horaires rendue sous `ref`, comme un doigt qui la
 * ferait glisser. La grille garde son propre défilement : on n'en pilote que la
 * position.
 */
function useGridPan(
  ref: React.RefObject<HTMLDivElement | null>,
  gridStartHour: number,
  still: boolean,
) {
  useEffect(() => {
    const scrollTo = (hour: number) => {
      // `cursor-grab` : la rangée de pastilles défile aussi (`overflow-x-auto`),
      // seule la grille se fait glisser à la main.
      const grid = ref.current?.querySelector<HTMLElement>(
        ".overflow-x-auto.cursor-grab",
      );
      if (grid) {
        grid.scrollLeft = (hour - gridStartHour) * 60 * PIXEL_PER_MINUTE;
      }
    };
    if (still) {
      // Deux fois : la grille, en pleine journée, défile d'elle-même jusqu'à
      // « maintenant » juste après son montage.
      scrollTo(PAN_STILL);
      const id = setTimeout(() => scrollTo(PAN_STILL), 900);
      return () => clearTimeout(id);
    }
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const phase = ((now - start) / PAN_PERIOD_MS) * 2 * Math.PI;
      const middle = (PAN_FROM + PAN_TO) / 2;
      scrollTo(middle - ((PAN_TO - PAN_FROM) / 2) * Math.cos(phase));
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [ref, gridStartHour, still]);
}

export function HoursScene() {
  const tTabs = useTranslations("tabs");
  const still = useStillness();
  const loop = useLoop(HOURS_CYCLE.length, 3200, !still);
  const family = HOURS_CYCLE[still ? 0 : loop];
  const direction = useSlideDirection(HOURS_PILLS.indexOf(family));
  // Rebâties une fois, sur la date du jour : voir `demo-data.ts`.
  const hours = useMemo(() => dlpHours(), []);
  const parkDate = useMemo(() => parkToday(DLP.timezone).toISODate(), []);
  const panRef = useRef<HTMLDivElement>(null);
  useGridPan(panRef, DLP_GRID_START_HOUR, still);

  return (
    <SceneFrame tint={["bg-restaurant/25", "bg-sky-400/20", "bg-primary/20"]}>
      <Miniature width={LIST_WIDTH}>
        <DemoState favorites={DLP_FAVORITES}>
          <div className="flex w-full flex-col gap-3">
            {/* La carte des onglets (`main-card.tsx`), sur « Horaires du
                jour ». */}
            <Tabs value="show-times">
              <Card
                className={cn(
                  "w-full gap-0 rounded-full p-(--tab-pad)",
                  TAB_GEOMETRY,
                )}
              >
                <TabsList className="relative w-full overflow-hidden rounded-full">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute top-[3px] bottom-[3px] left-[3px] w-[calc(50%-3px)] translate-x-full rounded-full bg-background shadow-sm dark:border dark:border-input dark:bg-input/30"
                  />
                  <TabsTrigger
                    value="wait-times"
                    className="relative z-10 rounded-full data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent"
                  >
                    <Radio />
                    {tTabs("live")}
                  </TabsTrigger>
                  <TabsTrigger
                    value="show-times"
                    className="relative z-10 rounded-full data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent"
                  >
                    <CalendarClock />
                    {tTabs("schedule")}
                  </TabsTrigger>
                </TabsList>
              </Card>
            </Tabs>

            <div ref={panRef}>
              <FamilyListCard
                families={HOURS_PILLS}
                family={family}
                direction={direction}
              >
                <PoiHoursTable
                  items={hours[family]}
                  timezone={DLP.timezone}
                  parkDate={parkDate}
                  parkIdentifier={DLP.identifier}
                  parkName={DLP.name}
                  waitTimes={[]}
                />
              </FamilyListCard>
            </div>
          </div>
        </DemoState>
      </Miniature>
    </SceneFrame>
  );
}

/* ========================================================================== */
/* 3. La fiche — le popup de Big Thunder Mountain                              */
/* ========================================================================== */

/**
 * La ligne d'alerte du popup, repliée ou armée.
 *
 * ⚠️ Recopie des deux états de la ligne de `alert-section.tsx` (mêmes
 * `ALERT_ROW` et `ALERT_ICON_TILE`, mêmes boutons) : le vrai composant charge
 * les alertes du compte et demande la permission des notifications, ce qu'une
 * démonstration ne doit pas faire.
 */
function AlertRowDemo({
  armed,
  title,
  activeLabel,
  subtitle,
}: {
  armed: boolean;
  title: string;
  activeLabel: string;
  subtitle: string;
}) {
  const t = useTranslations("attractionDetail");
  return armed ? (
    <div className={cn(ALERT_ROW, "border-primary/35 bg-primary/10 py-2 pr-1.5")}>
      <span className={cn(ALERT_ICON_TILE, "bg-primary text-primary-foreground")}>
        <BellRing className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">
          {activeLabel}
        </span>
      </span>
      <Button variant="ghost" size="sm">
        {t("alertEdit")}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("delete")}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  ) : (
    <div className={cn(ALERT_ROW, "bg-muted/40")}>
      <span className={cn(ALERT_ICON_TILE, "bg-primary/15 text-primary")}>
        <BellRing className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </div>
  );
}

export function DetailScene() {
  const t = useTranslations("attractionDetail");
  const still = useStillness();
  const banners = useSceneBanners();
  // L'alerte se pose puis se retire : c'est la seule action du popup.
  // Immobile, la ligne reste au repos : « Alerte active » se tronque sur un
  // téléphone, l'invitation se lit en entier.
  const loop = useLoop(2, 2600, !still);
  const armed = !still && loop === 1;

  return (
    <SceneFrame tint={["bg-violet-400/25", "bg-primary/25", "bg-sky-400/20"]}>
      <Miniature width={POPUP_WIDTH} maxScale={0.6}>
        <DemoState favorites={DLP_FAVORITES}>
          <PopupFrame>
            <div className="shrink-0">
              <ImageSection
                title="Big Thunder Mountain"
                favNamespace="rides"
                favKey={`${DLP.identifier}:${BIG_THUNDER_ID}`}
                place="Frontierland"
                banner={banners.bigThunder}
                credit={DLP.name}
                overlapped
              />
              <div className="relative z-10 -mt-10 px-4">
                <LiveStats
                  queue={DLP_RIDES[0].queues[0]}
                  hours={null}
                  waitCap={null}
                >
                  <Stat label={t("liveClosesAt")}>
                    <StatTime>22:00</StatTime>
                  </Stat>
                </LiveStats>
              </div>
            </div>
            <div className="flex flex-col gap-5 px-5 pt-5 pb-5">
              <AlertRowDemo
                armed={armed}
                title={t("alertRowTitle")}
                activeLabel={t("alertActiveRow", { minutes: 30 })}
                subtitle={t("alertRowPick")}
              />
            </div>
          </PopupFrame>
        </DemoState>
      </Miniature>
    </SceneFrame>
  );
}

/* ========================================================================== */
/* 4. Les files — la ligne se déplie, la file Disney Premier Access s'ouvre    */
/* ========================================================================== */

export function QueuesScene() {
  const t = useTranslations("attractionDetail");
  const still = useStillness();
  const banners = useSceneBanners();
  // 0 : repliée · 1 : dépliée · 2 : le popup de la file Disney Premier Access.
  // Immobile, la scène s'arrête sur le popup : c'est lui, la nouveauté, et la
  // scène est taillée pour lui.
  const step = useLoop(3, 2200, !still);
  const expanded = still || step > 0;
  const popup = still || step === 2;

  return (
    <SceneFrame tint={["bg-sky-400/25", "bg-primary/25", "bg-violet-400/20"]}>
      <Miniature width={LIST_WIDTH} maxScale={0.6}>
        <DemoState
          favorites={DLP_FAVORITES}
          alertQueues={[[HYPERSPACE_ID, "virtualqueue"]]}
        >
          <div className="relative">
            <FamilyListCard families={PARK_FAMILIES} family="ride" direction={1}>
              {/* `key` : déplier une ligne n'est pas animé sur le site non
                  plus — on remonte simplement la liste dépliée. */}
              <ParkWaitTimeTable
                key={expanded ? "open" : "closed"}
                waitTimes={[HYPERSPACE, DLP_RIDES[0], DLP_RIDES[2]]}
                queueTypeLabels={DLP.queueTypeLabels}
                parkIdentifier={DLP.identifier}
                parkName={DLP.name}
                defaultExpandedRideIds={expanded ? [HYPERSPACE_ID] : []}
              />
            </FamilyListCard>

            {/* Le popup de la file (`attraction-detail-dialog.tsx`) : son nom
                en titre, l'attraction dessous, son créneau dans le bandeau. */}
            <PopupOverlay open={popup}>
              <div className="shrink-0">
                <ImageSection
                  title="Disney Premier Access"
                  subtitle={HYPERSPACE.rideName}
                  favNamespace="rides"
                  favKey={`${DLP.identifier}:${HYPERSPACE_ID}`}
                  place={HYPERSPACE.zone}
                  banner={banners.hyperspace}
                  credit={DLP.name}
                  overlapped
                />
                <div className="relative z-10 -mt-10 px-4">
                  <LiveStats
                    queue={HYPERSPACE.queues[2]}
                    hours={null}
                    waitCap={null}
                  >
                    <Stat label={t("liveClosesAt")}>
                      <StatTime>22:00</StatTime>
                    </Stat>
                  </LiveStats>
                </div>
              </div>
              <div className="flex flex-col gap-5 px-5 pt-5 pb-5">
                <AlertRowDemo
                  armed
                  title={t("slotRowTitle")}
                  activeLabel={t("slotActiveRow", { time: "14:00" })}
                  subtitle={t("slotRowPick")}
                />
                {/* Le retour à l'attraction, recopié du popup. */}
                <div className="flex w-full items-center gap-3 rounded-2xl border bg-muted/40 px-3 py-2.5 text-left">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                    <FerrisWheel className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {t("queueSeeRide")}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {HYPERSPACE.rideName}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </div>
              </div>
            </PopupOverlay>
          </div>
        </DemoState>
      </Miniature>
    </SceneFrame>
  );
}

/* ========================================================================== */
/* 5. Les prévisions — le graphique du popup, trace grise et fourchettes       */
/* ========================================================================== */

export function ForecastScene() {
  // Une fois : le graphique ne doit pas se retracer à chaque rendu.
  const history = useMemo(() => rangedRideHistory(), []);

  return (
    <SceneFrame tint={["bg-primary/25", "bg-sky-400/20", "bg-emerald-400/20"]}>
      <Miniature width={POPUP_WIDTH}>
        {/* Le corps du popup d'une attraction, sous la ligne d'alerte. */}
        <div className="rounded-4xl bg-background px-5 py-5 shadow-lg">
          <ChartSection
            data={history}
            loading={false}
            currentWaitTime={20}
            currentStatus="open"
          />
        </div>
      </Miniature>
    </SceneFrame>
  );
}

/* ========================================================================== */
/* 6. Halloween — la carte de Halloween Fright Nights, puis Slaughterhouse     */
/* ========================================================================== */

export function HalloweenScene() {
  const t = useTranslations("attractionDetail");
  const tCards = useTranslations("parkPage.cards");
  const tTabs = useTranslations("tabs");
  const still = useStillness();
  const banners = useSceneBanners();
  // 0 : la carte de l'événement · 1 : le popup de la maison.
  const loop = useLoop(2, 3000, !still);
  const popup = !still && loop === 1;
  const { event, closesAt } = useMemo(() => frightNights(), []);
  const facts = usePoiFacts(5, null);

  return (
    <SceneFrame tint={["bg-red-400/25", "bg-orange-400/20", "bg-violet-400/20"]}>
      <Miniature width={LIST_WIDTH} maxScale={0.68}>
        <DemoState favorites={FRIGHT_NIGHTS_FAVORITES}>
          {/* `bg-background` : la carte d'événement n'est qu'un voile teinté
              (`event-accents.tsx`), posé sur le FOND DE LA PAGE. Sur le décor
              de la scène, elle prenait ses couleurs. */}
          <div className="relative rounded-4xl bg-background">
            <EventCard
              view={{ event, state: "running", boundary: closesAt }}
              timezone={WALIBI_HOLLAND.timezone}
              className="rounded-4xl"
              headerAside={
                <FamilySwitcher
                  options={(["ride", "show"] as const).map((family) => ({
                    family,
                    label: tCards(CARD_TITLE_KEYS[family]),
                    icon: POI_KIND_ICONS[family],
                  }))}
                  value="ride"
                  onChange={() => {}}
                  ariaLabel={tTabs("families")}
                  idPrefix="whats-new-halloween"
                  panelId="whats-new-halloween-panel"
                />
              }
            >
              <ParkWaitTimeTable
                waitTimes={[]}
                unlisted={FRIGHT_NIGHTS_HOUSES}
                parkIdentifier={WALIBI_HOLLAND.identifier}
                parkName={WALIBI_HOLLAND.name}
              />
            </EventCard>

            {/* Le popup d'une maison : son heure de fermeture et sa peur dans
                le bandeau, comme sur le site. */}
            <PopupOverlay open={popup}>
              <ImageSection
                title="Slaughterhouse"
                favNamespace="rides"
                favKey={`${WALIBI_HOLLAND.identifier}:${SLAUGHTERHOUSE_ID}`}
                place="Experience"
                banner={banners.slaughterhouse}
                credit={WALIBI_HOLLAND.name}
                overlapped
              />
              <div className="relative z-10 -mt-10 px-4 pb-5">
                <LiveStats queue={undefined} hours={null} waitCap={null}>
                  <Stat label={t("liveClosesAt")}>
                    <StatTime>23:00</StatTime>
                  </Stat>
                  {poiFactStats(facts)}
                </LiveStats>
              </div>
            </PopupOverlay>
          </div>
        </DemoState>
      </Miniature>
    </SceneFrame>
  );
}

/* ========================================================================== */
/* 7. Clôture — confettis                                                      */
/* ========================================================================== */

// Positions/retards figés : la scène doit être identique à chaque ouverture.
const CONFETTI = Array.from({ length: 16 }, (_, index) => ({
  left: `${4 + index * 6}%`,
  delay: ((index * 7) % 10) / 10,
  duration: 2.6 + ((index * 3) % 5) / 4,
  rotate: (index % 2 ? 1 : -1) * (180 + index * 12),
  color: [
    "bg-primary",
    "bg-amber-400",
    "bg-rose-400",
    "bg-sky-400",
    "bg-emerald-400",
  ][index % 5],
}));

export function FinaleScene() {
  const still = useStillness();

  return (
    <SceneFrame>
      {!still && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {CONFETTI.map((piece, index) => (
            <motion.span
              key={index}
              className={cn("absolute -top-3 h-2.5 w-1.5 rounded-[2px]", piece.color)}
              style={{ left: piece.left }}
              initial={{ y: -12, opacity: 0, rotate: 0 }}
              animate={{ y: 240, opacity: [0, 1, 1, 0], rotate: piece.rotate }}
              transition={{
                duration: piece.duration,
                delay: piece.delay,
                repeat: Infinity,
                repeatDelay: 1.4,
                ease: "linear",
              }}
            />
          ))}
        </div>
      )}

      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 16 }}
        className="relative flex flex-col items-center gap-3"
      >
        <div className="relative">
          <motion.span
            className="absolute inset-0 rounded-3xl bg-primary/30 blur-2xl"
            animate={still ? undefined : { scale: [1, 1.3, 1], opacity: [0.5, 0.9, 0.5] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
          />
          <Image
            src="/web-app-manifest-192x192.png"
            alt=""
            width={192}
            height={192}
            className="relative size-16 drop-shadow-lg"
          />
        </div>
        <span className="flex items-center gap-2 rounded-full border border-border/60 bg-card/85 px-3.5 py-1 text-xs font-bold shadow-sm backdrop-blur-sm">
          Queue Park
          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-extrabold text-primary-foreground">
            v{WHATS_NEW_VERSION}
          </span>
        </span>
      </motion.div>
    </SceneFrame>
  );
}
