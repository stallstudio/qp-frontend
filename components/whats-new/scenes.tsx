"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Bell,
  BellRing,
  CalendarClock,
  ChevronRight,
  CornerDownRight,
  Ghost,
  LayoutGrid,
  LineChart,
  MapPin,
  Skull,
  TicketCheck,
  User,
  UtensilsCrossed,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { WHATS_NEW_VERSION } from "@/lib/whats-new";
import { POI_KIND_ICONS, type PoiKind } from "@/lib/poi-kinds";
import SceneFrame, {
  SceneActivity,
  useSceneBanners,
  useSceneContext,
} from "./scene-frame";

export { SceneActivity };

// ————————————————————————————————————————————————————————————————————————
// LES SCÈNES DE L'ANNONCE DE VERSION
//
// Une par nouveauté. Chacune MIME l'interface réelle plutôt que d'illustrer une
// idée : on reconnaît la pastille de famille, la frise des horaires, le bandeau
// de la fiche, la carte d'événement. C'est ce qui fait qu'une annonce se lit
// comme une démonstration et pas comme une publicité.
//
// ⚠️ **Purement décoratives.** Le cadre commun (`SceneFrame`) les rend sous
// `aria-hidden` : les libellés qu'on y voit ne sont jamais la seule source d'une
// information, elle est toujours dite en toutes lettres dans le corps du dialog.
// Les rares textes affichés sont donc soit des noms propres, soit des clés déjà
// traduites ailleurs — celles de l'interface que la scène imite.
//
// ⚠️ **Aucune donnée réelle.** Tout est en dur et STABLE d'un rendu à l'autre :
// pas de `Math.random()` ni de `Date.now()` dans un rendu, ce qui garderait la
// scène différente entre serveur et client.
//
// ⚠️ **Ce qui est nommé DOIT exister tel quel dans le catalogue** — l'attraction,
// son parc, jusqu'au quartier affiché sur la fiche. Une démo qui montre un écran
// que l'application ne produit pas est une promesse qu'elle ne tiendra pas.
// D'où les BARRES NEUTRES à la place des noms partout où l'exemple n'a pas pu
// être vérifié en base (restaurants, files, maisons hantées) : la v3 faisait
// déjà ainsi pour les lignes de sa carte d'événement. Seule la fiche nomme une
// attraction, Taron, reprise de la v3 où elle avait été vérifiée.
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

/* ————— Les briques imitées de l'interface —————
   Mêmes couleurs que les vraies pastilles (`lib/badge.tsx`) et les vraies
   familles (`family-switcher.tsx`), en classes ENTIÈRES : Tailwind ne voit pas
   les classes fabriquées. */

/** Un nom de ligne qu'on ne cite pas : une barre, de la largeur donnée. */
function NameBar({ width }: { width: string }) {
  return (
    <span
      className={cn("h-1.5 shrink-0 rounded-full bg-foreground/15", width)}
    />
  );
}

function waitBadgeTone(minutes: number): string {
  if (minutes <= 20) return "bg-green-100 text-green-700";
  if (minutes <= 40) return "bg-orange-100 text-orange-700";
  return "bg-red-100 text-red-700";
}

function WaitBadge({ label, minutes }: { label: string; minutes: number }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums whitespace-nowrap",
        waitBadgeTone(minutes),
      )}
    >
      {label}
    </span>
  );
}

type SceneStatus = "open" | "closed" | "down";

const STATUS_BADGE: Record<SceneStatus, { pill: string; dot: string }> = {
  open: { pill: "bg-green-100 text-green-700", dot: "bg-green-400" },
  closed: { pill: "bg-red-100 text-red-700", dot: "bg-red-400" },
  down: { pill: "bg-orange-100 text-orange-700", dot: "bg-orange-300" },
};

function StatusBadge({ status }: { status: SceneStatus }) {
  const tStatus = useTranslations("attractionStatus");
  const tone = STATUS_BADGE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap",
        tone.pill,
      )}
    >
      <span className={cn("size-1.5 rounded-full", tone.dot)} />
      {tStatus(status === "down" ? "downShort" : status)}
    </span>
  );
}

const FAMILY_PILL: Record<PoiKind, string> = {
  ride: "bg-primary text-primary-foreground",
  show: "bg-show text-show-foreground",
  restaurant: "bg-restaurant text-restaurant-foreground",
  shop: "bg-shop text-shop-foreground",
  hotel: "bg-hotel text-hotel-foreground",
  service: "bg-service text-service-foreground",
};

// Le titre de chaque famille, dans `parkPage.cards` (voir `main-card.tsx`).
const FAMILY_LABEL_KEYS: Record<PoiKind, string> = {
  ride: "attractions",
  show: "shows",
  restaurant: "restaurants",
  shop: "shops",
  hotel: "hotels",
  service: "services",
};

/**
 * La rangée de pastilles de famille : l'active se teinte et dévoile son nom,
 * les autres restent des pictogrammes gris — comme `FamilySwitcher`.
 */
function FamilyPills({
  families,
  active,
}: {
  families: readonly PoiKind[];
  active: PoiKind;
}) {
  const tCards = useTranslations("parkPage.cards");
  return (
    <div className="flex items-center gap-1">
      {families.map((family) => {
        const Icon = POI_KIND_ICONS[family];
        const isActive = family === active;
        return (
          <motion.span
            key={family}
            layout
            transition={{ type: "spring", bounce: 0.22, duration: 0.5 }}
            className={cn(
              "inline-flex h-6 shrink-0 items-center rounded-full text-[11px] font-semibold transition-colors duration-300",
              isActive
                ? cn("px-2.5", FAMILY_PILL[family])
                : "bg-muted px-2 text-muted-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {isActive && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                className="ms-1 overflow-hidden whitespace-nowrap"
              >
                {tCards(FAMILY_LABEL_KEYS[family])}
              </motion.span>
            )}
          </motion.span>
        );
      })}
    </div>
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
/* 1. Tout le parc — les pastilles de famille, la liste qui glisse             */
/* ========================================================================== */

type ParkRow = {
  name: string;
  wait?: { label: string; minutes: number };
  status: SceneStatus;
};

// Trois familles, et ce que chacune montre vraiment : des attentes pour les
// attractions, une attente ou un état pour les restaurants (les parcs PRS en
// publient une), un état seulement pour les boutiques.
const PARK_FAMILIES: { family: PoiKind; rows: ParkRow[] }[] = [
  {
    family: "ride",
    rows: [
      { name: "w-28", wait: { label: "35 min", minutes: 35 }, status: "open" },
      { name: "w-20", wait: { label: "10 min", minutes: 10 }, status: "open" },
      { name: "w-24", status: "down" },
    ],
  },
  {
    family: "restaurant",
    rows: [
      { name: "w-24", wait: { label: "10 min", minutes: 10 }, status: "open" },
      { name: "w-32", wait: { label: "20 min", minutes: 20 }, status: "open" },
      { name: "w-20", status: "closed" },
    ],
  },
  {
    family: "shop",
    rows: [
      { name: "w-28", status: "open" },
      { name: "w-20", status: "open" },
      { name: "w-24", status: "closed" },
    ],
  },
];

// Les pastilles affichées : les spectacles en plus, jamais choisis ici — la
// rangée dit qu'il y a d'autres familles, sans que la scène les parcoure.
const PARK_PILLS: readonly PoiKind[] = ["ride", "show", "restaurant", "shop"];

export function ParkScene() {
  const still = useStillness();
  // Immobile, la scène s'arrête sur les restaurants : c'est la nouveauté.
  const index = useLoop(PARK_FAMILIES.length, 2400, !still);
  const current = PARK_FAMILIES[still ? 1 : index];

  return (
    <SceneFrame
      tint={["bg-restaurant/25", "bg-primary/20", "bg-shop/25"]}
    >
      <div className="w-full max-w-[19rem] rounded-2xl border border-border/60 bg-card/85 p-2.5 shadow-sm backdrop-blur-sm">
        <FamilyPills families={PARK_PILLS} active={current.family} />

        <div className="mt-2 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.family}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="divide-y divide-border/60"
            >
              {current.rows.map((row, position) => (
                <div
                  key={position}
                  className="flex h-7 items-center gap-2 px-1"
                >
                  <NameBar width={row.name} />
                  <span className="flex-1" />
                  {row.wait && (
                    <WaitBadge label={row.wait.label} minutes={row.wait.minutes} />
                  )}
                  <StatusBadge status={row.status} />
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </SceneFrame>
  );
}

/* ========================================================================== */
/* 2. Les horaires — la frise du jour, la ligne « maintenant » qui avance      */
/* ========================================================================== */

// L'axe de la frise : de 9 h à minuit.
const AXIS_START = 9;
const AXIS_END = 24;
const AXIS_TICKS = [10, 14, 18, 22];

const at = (hour: number) =>
  `${((hour - AXIS_START) / (AXIS_END - AXIS_START)) * 100}%`;
const span = (from: number, to: number) =>
  `${((to - from) / (AXIS_END - AXIS_START)) * 100}%`;

const hhmm = (hour: number) =>
  `${String(Math.floor(hour)).padStart(2, "0")}:${hour % 1 ? "30" : "00"}`;

// Des restaurants, triés comme la vraie liste : la fermeture la plus tardive
// en tête. Le troisième ferme entre le déjeuner et le dîner — deux barres sur
// la même ligne, comme le service coupé qu'un parc publie.
const HOURS_ROWS: { name: string; slots: [number, number][] }[] = [
  { name: "w-14", slots: [[11, 23]] },
  { name: "w-10", slots: [[11.5, 22]] },
  { name: "w-12", slots: [[12, 14.5], [18.5, 21.5]] },
  { name: "w-9", slots: [[10, 18]] },
];

export function HoursScene() {
  const tTabs = useTranslations("tabs");
  const still = useStillness();

  return (
    <SceneFrame tint={["bg-restaurant/25", "bg-sky-400/20", "bg-primary/20"]}>
      <div className="w-full max-w-[20rem] rounded-2xl border border-border/60 bg-card/85 p-2.5 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <CalendarClock className="size-3.5" />
            {tTabs("schedule")}
          </span>
          <FamilyPills families={["restaurant"]} active="restaurant" />
        </div>

        <div className="mt-2 flex gap-2">
          {/* La colonne des noms. */}
          <div className="flex flex-col pt-3.5">
            {HOURS_ROWS.map((row, position) => (
              <div key={position} className="flex h-5 items-center">
                <NameBar width={row.name} />
              </div>
            ))}
          </div>

          {/* La frise. */}
          <div className="relative flex-1">
            <div className="relative h-3.5 text-[8px] text-muted-foreground tabular-nums">
              {AXIS_TICKS.map((hour) => (
                <span
                  key={hour}
                  className="absolute -translate-x-1/2"
                  style={{ left: at(hour) }}
                >
                  {hour}h
                </span>
              ))}
            </div>
            {HOURS_ROWS.map((row, position) => (
              <div key={position} className="relative h-5">
                {row.slots.map(([from, to]) => (
                  <motion.span
                    key={from}
                    className="absolute top-1 flex h-3 items-center justify-center overflow-hidden rounded-full bg-restaurant/80 text-[7.5px] font-semibold whitespace-nowrap text-restaurant-foreground"
                    style={{ left: at(from), width: span(from, to) }}
                    initial={still ? false : { scaleX: 0, opacity: 0 }}
                    animate={{ scaleX: 1, opacity: 1 }}
                    transition={{
                      delay: 0.15 + position * 0.12,
                      duration: 0.45,
                      ease: "easeOut",
                    }}
                  >
                    {to - from >= 4 && `${hhmm(from)} – ${hhmm(to)}`}
                  </motion.span>
                ))}
              </div>
            ))}

            {/* « Maintenant » : la ligne avance dans la journée. Atténuée, pour
                ne pas barrer les horaires écrits dans les barres. */}
            <motion.span
              className="absolute top-3.5 bottom-0 w-px bg-primary/50"
              initial={{ left: at(13) }}
              animate={
                still ? { left: at(16) } : { left: [at(13), at(20), at(13)] }
              }
              transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
            >
              <span className="absolute -top-1 -left-[3px] size-[7px] rounded-full bg-primary" />
            </motion.span>
          </div>
        </div>
      </div>
    </SceneFrame>
  );
}

/* ========================================================================== */
/* 3. La fiche — la photo, le bandeau de chiffres, l'alerte en une ligne       */
/* ========================================================================== */

export function DetailScene() {
  const t = useTranslations("attractionDetail");
  const tStatus = useTranslations("attractionStatus");
  const still = useStillness();
  const banners = useSceneBanners();
  // La ligne d'alerte s'arme puis se repose : c'est la seule action de la fiche.
  const armed = useLoop(2, 2600, !still) === 1;

  return (
    <SceneFrame tint={["bg-violet-400/25", "bg-primary/25", "bg-sky-400/20"]}>
      <div className="w-full max-w-[17.5rem]">
        {/* ⚠️ Recopie du VRAI en-tête de popup (`image-section.tsx`) : la photo
            que Phantasialand publie pour Taron, et « MYSTERY », le quartier que
            la SOURCE publie pour elle — vérifiés pour la v3. */}
        <div className="relative h-24 overflow-hidden rounded-xl border border-border/60 shadow-sm">
          <Image
            src={banners.ride}
            alt=""
            fill
            sizes="280px"
            className="object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/80 via-black/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-0.5 px-3 pb-6">
            <p className="text-sm font-bold text-white drop-shadow-sm">Taron</p>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-white/90 drop-shadow-sm">
              <MapPin className="size-3" />
              MYSTERY
            </span>
          </div>
        </div>

        {/* Le bandeau à cheval sur la photo (`live-stats.tsx`). */}
        <div className="relative z-10 mx-2 -mt-5 grid grid-cols-3 divide-x divide-border rounded-2xl border bg-card/90 shadow-md backdrop-blur-md">
          <div className="flex min-w-0 flex-col px-2 py-1.5">
            <span className="truncate text-[9px] text-muted-foreground">
              {t("liveWait")}
            </span>
            <span className="text-base leading-5 font-bold tabular-nums text-orange-600 dark:text-orange-400">
              35<span className="ml-0.5 text-[10px] font-semibold">min</span>
            </span>
          </div>
          <div className="flex min-w-0 flex-col px-2 py-1.5">
            <span className="truncate text-[9px] text-muted-foreground">
              {t("liveStatus")}
            </span>
            <span className="flex h-5 items-center gap-1.5 text-xs font-semibold text-green-700 dark:text-green-100">
              <span className="relative size-1.5 shrink-0">
                <span className="absolute inset-0 rounded-full bg-green-400" />
                {!still && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-green-400" />
                )}
              </span>
              {tStatus("open")}
            </span>
          </div>
          <div className="flex min-w-0 flex-col px-2 py-1.5">
            <span className="truncate text-[9px] text-muted-foreground">
              {t("liveClosesAt")}
            </span>
            <span className="text-base leading-5 font-bold tabular-nums">
              18:00
            </span>
          </div>
        </div>

        {/* La ligne d'alerte (`alert-section.tsx`), qui passe d'« à régler » à
            « active ». */}
        <div className="mt-2 flex items-center gap-2 rounded-xl border bg-card/85 px-2 py-1.5 backdrop-blur-sm">
          <span
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded-md transition-colors duration-300",
              armed ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary",
            )}
          >
            <motion.span
              key={String(armed)}
              initial={still || !armed ? false : { rotate: 0 }}
              animate={armed && !still ? { rotate: [0, -18, 14, -8, 0] } : undefined}
              transition={{ duration: 0.7 }}
            >
              {armed ? (
                <BellRing className="size-3.5" />
              ) : (
                <Bell className="size-3.5" />
              )}
            </motion.span>
          </span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={String(armed)}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="truncate text-[11px] font-semibold"
            >
              {armed
                ? t("alertActiveRow", { minutes: 20 })
                : t("alertRowTitle")}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </SceneFrame>
  );
}

/* ========================================================================== */
/* 4. Les files — la ligne se déplie, le créneau avance                        */
/* ========================================================================== */

export function QueuesScene() {
  const still = useStillness();
  // 0 : repliée · 1 : dépliée · 2 : un créneau plus tôt vient de s'ouvrir.
  const step = useLoop(3, 1700, !still);
  const expanded = still || step > 0;
  const earlier = still || step === 2;

  return (
    <SceneFrame tint={["bg-sky-400/25", "bg-primary/25", "bg-violet-400/20"]}>
      <div className="w-full max-w-[19rem] rounded-2xl border border-border/60 bg-card/85 px-2.5 py-1 shadow-sm backdrop-blur-sm">
        {/* La ligne de l'attraction, son chevron, sa file classique. */}
        <div className="flex h-8 items-center gap-1.5">
          <NameBar width="w-24" />
          <motion.span
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-muted-foreground"
          >
            <ChevronRight className="size-3.5" />
          </motion.span>
          <span className="flex-1" />
          <WaitBadge label="45 min" minutes={45} />
          <StatusBadge status="open" />
        </div>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              className="overflow-hidden"
            >
              {/* Les files secondaires (`wait-time-table.tsx`) : leur nom, que
                  le parc leur donne, et leur pictogramme. */}
              <div className="flex h-7 items-center gap-1 border-t text-[10px] font-medium text-muted-foreground">
                <CornerDownRight className="size-3" />
                Single Rider
                <User className="size-3" />
                <span className="flex-1" />
                <WaitBadge label="15 min" minutes={15} />
              </div>
              <div className="flex h-7 items-center gap-1 border-t text-[10px] font-medium text-muted-foreground">
                <CornerDownRight className="size-3" />
                <span className="truncate">Disney Premier Access</span>
                {/* L'alerte de créneau posée sur CETTE file. */}
                <motion.span
                  key={String(earlier)}
                  initial={false}
                  animate={
                    earlier && !still ? { rotate: [0, -18, 14, -8, 0] } : undefined
                  }
                  transition={{ duration: 0.7 }}
                  className="text-primary"
                >
                  <BellRing className="size-3" />
                </motion.span>
                <span className="flex-1" />
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={String(earlier)}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.25 }}
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums whitespace-nowrap",
                      earlier
                        ? "bg-green-100 text-green-700"
                        : "bg-sky-100 text-sky-700",
                    )}
                  >
                    {earlier ? "13:45–14:00" : "14:30–14:45"}
                  </motion.span>
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SceneFrame>
  );
}

/* ========================================================================== */
/* 5. Les prévisions — ce qui était prévu, ce qui s'est passé, ce qui vient    */
/* ========================================================================== */

// Trois tracés dans un viewBox de 260 × 90 : l'observé (plein), ce qui avait
// été prévu une heure avant pour la même période (gris fin, dessous), et la
// prévision à venir (pointillé), qui part de `NOW_X`.
const OBSERVED_PATH = "M8 72 L38 66 L68 52 L98 40 L128 30 L150 34";
const TRAIL_PATH = "M8 70 L38 62 L68 56 L98 46 L128 34 L150 30";
const FORECAST_PATH = "M150 34 L178 22 L206 30 L232 46 L252 62";
const NOW_X = 150;

export function ForecastScene() {
  const t = useTranslations("attractionDetail");
  const still = useStillness();

  return (
    <SceneFrame tint={["bg-primary/25", "bg-sky-400/20", "bg-emerald-400/20"]}>
      <div className="relative w-full max-w-[19rem] rounded-2xl border border-border/60 bg-card/85 p-3 shadow-sm backdrop-blur-sm">
        {/* La fourchette telle que le parc l'annonce. */}
        <motion.span
          className="absolute top-2 right-2 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-green-700"
          initial={still ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.4 }}
        >
          10–20 min
        </motion.span>

        <svg viewBox="0 0 260 90" className="w-full" role="presentation">
          {[24, 48, 72].map((y) => (
            <line
              key={y}
              x1="8"
              x2="252"
              y1={y}
              y2={y}
              className="stroke-border"
              strokeWidth="1"
              strokeDasharray="2 6"
            />
          ))}

          {/* La trace grise, DESSOUS : une comparaison, pas une troisième
              courbe à lire (voir `wait-time-chart.tsx`). */}
          <motion.path
            d={TRAIL_PATH}
            fill="none"
            className="stroke-muted-foreground/60"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            strokeLinecap="round"
            initial={still ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.6 }}
          />

          <motion.path
            d={`${OBSERVED_PATH} L150 82 L8 82 Z`}
            className="fill-primary/15"
            initial={still ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          />

          <motion.path
            d={OBSERVED_PATH}
            fill="none"
            className="stroke-primary"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={still ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, ease: "easeInOut" }}
          />

          {/* ⚠️ PAS de `pathLength` animé ici : motion piloterait
              `strokeDasharray` et écraserait le pointillé, qui est justement
              ce qui distingue l'estimation de l'observé. */}
          <motion.path
            d={FORECAST_PATH}
            fill="none"
            className="stroke-primary/60"
            strokeWidth="2.5"
            strokeDasharray="5 5"
            strokeLinecap="round"
            initial={still ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1, duration: 0.7, ease: "easeOut" }}
          />

          <line
            x1={NOW_X}
            x2={NOW_X}
            y1="6"
            y2="82"
            className="stroke-foreground/25"
            strokeWidth="1.5"
            strokeDasharray="3 4"
          />
          <motion.circle
            cx={NOW_X}
            cy="34"
            r="4"
            className="fill-primary"
            animate={still ? undefined : { scale: [1, 1.35, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: `${NOW_X}px 34px` }}
          />
        </svg>

        <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 rounded bg-primary" />
            {t("chartLegendActual")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 border-t-[1.5px] border-dashed border-muted-foreground/70" />
            {t("chartForecastPast")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 border-t-2 border-dashed border-primary/60" />
            {t("chartForecastLegend")}
          </span>
        </div>
      </div>
    </SceneFrame>
  );
}

/* ========================================================================== */
/* 6. Halloween — la carte de l'événement, la peur maison par maison           */
/* ========================================================================== */

// Les maisons de la carte : leur niveau de peur, et leur prix. Des valeurs
// d'exemple — en euros, parce que les seuls parcs qui publient un prix
// (Compagnie des Alpes) sont tous en zone euro.
const HOUSES: { name: string; fear: number; price: "free" | string }[] = [
  { name: "w-20", fear: 5, price: "8 €" },
  { name: "w-16", fear: 3, price: "8 €" },
  { name: "w-24", fear: 2, price: "free" },
];

// Mêmes chutes que la v3 : déterministes, à pas irrégulier.
const PARTICLES = Array.from({ length: 9 }, (_, index) => ({
  left: `${6 + index * 10.5}%`,
  delay: (index % 5) * 0.55,
  duration: 4 + (index % 3),
}));

export function HalloweenScene() {
  const t = useTranslations("whatsNew.scenes.halloween");
  const tEvents = useTranslations("events");
  const tFacts = useTranslations("poiFacts");
  const still = useStillness();
  // Les crânes se remplissent un à un, puis tout repart.
  const filled = useLoop(6, 700, !still);
  const shown = still ? 5 : filled;

  return (
    <SceneFrame tint={["bg-red-400/25", "bg-orange-400/20", "bg-violet-400/20"]}>
      {!still && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {PARTICLES.map((particle, position) => (
            <motion.span
              key={position}
              className="absolute -top-2 size-1.5 rounded-full bg-red-400/60"
              style={{ left: particle.left }}
              animate={{ y: [0, 230], opacity: [0, 1, 0] }}
              transition={{
                duration: particle.duration,
                delay: particle.delay,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          ))}
        </div>
      )}

      {/* Mêmes couleurs que la vraie carte d'Halloween (`event-accents.tsx`),
          comme la v3. */}
      <div className="w-full max-w-[19rem] rounded-2xl border border-red-300/60 bg-red-50/80 p-2.5 shadow-sm backdrop-blur-sm dark:border-red-400/40 dark:bg-red-400/15">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-background/70 text-red-700 dark:text-red-300">
            <Ghost className="size-4" />
          </span>
          <span className="text-sm font-semibold text-red-700 dark:text-red-300">
            {t("title")}
          </span>
          <span className="ms-auto rounded-full bg-background/70 px-2 py-0.5 text-[9px] font-medium text-muted-foreground">
            {tEvents("closesAt", { time: "01:00" })}
          </span>
        </div>

        <div className="mt-2">
          <FamilyPills families={["ride", "show", "restaurant"]} active="ride" />
        </div>

        <div className="mt-1.5 divide-y divide-red-300/40 dark:divide-red-400/20">
          {HOUSES.map((house, position) => (
            <div key={position} className="flex h-6 items-center gap-2">
              <NameBar width={house.name} />
              <span className="flex-1" />
              <span className="flex items-center gap-px">
                {[1, 2, 3, 4, 5].map((step) => (
                  <Skull
                    key={step}
                    className={cn(
                      "size-3 transition-colors duration-300",
                      step <= Math.min(house.fear, shown)
                        ? "text-red-600 dark:text-red-400"
                        : "text-muted-foreground/30",
                    )}
                  />
                ))}
              </span>
              <span className="w-10 text-right text-[10px] font-semibold tabular-nums">
                {house.price === "free" ? tFacts("free") : house.price}
              </span>
            </div>
          ))}
        </div>
      </div>
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
