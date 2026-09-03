"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Bell,
  BellRing,
  CalendarClock,
  Clock,
  CloudRain,
  CloudSun,
  Drama,
  Ghost,
  Gift,
  LineChart,
  MapPin,
  RotateCcw,
  Sparkles,
  Star,
  Sun,
  Timer,
  UserRound,
} from "lucide-react";

import { cn } from "@/lib/utils";
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
// idée : on reconnaît la ligne d'attraction, la notification, la courbe, la
// carte d'événement. C'est ce qui fait qu'une annonce se lit comme une
// démonstration et pas comme une publicité.
//
// ⚠️ **Purement décoratives.** Le cadre commun (`SceneFrame`) les rend sous
// `aria-hidden` : les libellés qu'on y voit ne sont jamais la seule source d'une
// information, elle est toujours dite en toutes lettres dans le corps du dialog.
// Les rares textes affichés sont donc soit des noms propres (parcs et
// attractions, non traduisibles), soit des clés déjà traduites ailleurs.
//
// ⚠️ **Aucune donnée réelle.** Tout est en dur et STABLE d'un rendu à l'autre :
// pas de `Math.random()` ni de `Date.now()` dans un rendu, ce qui garderait la
// scène différente entre serveur et client.
//
// ⚠️ **Les noms propres viennent de PARCS DIFFÉRENTS, et c'est délibéré.** Toutes
// les scènes tiraient leurs exemples d'Europa-Park : une annonce qui ne nomme
// qu'un parc se lit comme le site de ce parc. Cedar Point, Disneyland Paris,
// Carowinds, Hollywood Studios, Phantasialand et Europa-Park se partagent
// désormais les scènes — le catalogue en compte plus de deux cents.
//
// ⚠️ **Ce qui est nommé DOIT exister tel quel dans le catalogue** : l'attraction,
// son parc, et jusqu'au quartier affiché sur la fiche (scène 5), vérifié dans
// `pois.additionalData.zone`. Une démo qui montre un écran que l'application ne
// produit pas est une promesse qu'elle ne tiendra pas.
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

/* ========================================================================== */
/* 0. Ouverture — le logo, entouré des nouveautés en orbite                   */
/* ========================================================================== */

const ORBIT_ICONS = [
  UserRound,
  Star,
  BellRing,
  LineChart,
  Sparkles,
  CloudSun,
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
            v3
          </span>
        </motion.div>
      </div>
    </SceneFrame>
  );
}

/* ========================================================================== */
/* 1. Le compte — deux appareils reliés par un flux                            */
/* ========================================================================== */

export function AccountScene() {
  const still = useStillness();

  return (
    <SceneFrame tint={["bg-primary/25", "bg-sky-400/25", "bg-violet-400/20"]}>
      <div className="relative flex w-full max-w-sm items-center justify-between">
        <DeviceFrame kind="phone" />

        {/* Le pont : un trait plein très pâle, et par-dessus un pointillé qui
            défile — le flux se lit sans qu'aucun objet ne bouge vraiment. */}
        <div className="relative mx-2 flex-1">
          <svg viewBox="0 0 160 60" className="w-full" role="presentation">
            <path
              d="M6 42 Q80 -6 154 42"
              fill="none"
              className="stroke-primary/20"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <motion.path
              d="M6 42 Q80 -6 154 42"
              fill="none"
              className="stroke-primary"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="3 10"
              animate={still ? undefined : { strokeDashoffset: [0, -52] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
            />
          </svg>

          {/* Le compte, au sommet de l'arc. */}
          <motion.span
            className="absolute left-1/2 top-0 flex size-10 -translate-x-1/2 -translate-y-1/3 items-center justify-center rounded-2xl border border-primary/30 bg-card text-primary shadow-md"
            animate={still ? undefined : { y: [0, -4, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <UserRound className="size-5" />
          </motion.span>
        </div>

        <DeviceFrame kind="desktop" />
      </div>
    </SceneFrame>
  );
}

/** Téléphone ou écran stylisés : assez d'indices pour être reconnus, pas plus. */
function DeviceFrame({ kind }: { kind: "phone" | "desktop" }) {
  const rows = (
    <div className="flex w-full flex-col gap-1.5 px-2">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-center gap-1.5">
          <span className="h-1.5 flex-1 rounded-full bg-foreground/15" />
          <Star className="size-2.5 fill-primary text-primary" />
        </div>
      ))}
    </div>
  );

  if (kind === "phone") {
    return (
      <div className="flex h-24 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border-2 border-foreground/15 bg-card/90 py-2 shadow-sm">
        <span className="mb-2 h-1 w-5 rounded-full bg-foreground/20" />
        {rows}
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-center">
      <div className="flex h-20 w-28 flex-col justify-center rounded-xl border-2 border-foreground/15 bg-card/90 py-2 shadow-sm">
        {rows}
      </div>
      <span className="h-1.5 w-20 rounded-b-lg bg-foreground/15" />
    </div>
  );
}

/* ========================================================================== */
/* 2. Les favoris — l'étoile s'allume, la ligne remonte                        */
/* ========================================================================== */

// Un parc, une attraction et un spectacle — de trois parcs distincts, pour que
// la ligne « favoris » se lise comme ce qu'elle est : une liste qui traverse le
// catalogue, pas le sommaire d'un parc.
const FAVORITE_ROWS = [
  { id: "park", label: "Disneyland Paris", icon: MapPin },
  { id: "ride", label: "Steel Vengeance", icon: Timer },
  { id: "show", label: "Fantasmic!", icon: Drama },
] as const;

export function FavoritesScene() {
  const still = useStillness();
  // 0 étoile, puis 1, puis 2, puis 3, puis on repart de zéro : la scène
  // « raconte » l'ajout au lieu de montrer un état déjà acquis.
  const step = useLoop(FAVORITE_ROWS.length + 1, 1300, !still);
  const starred = still ? FAVORITE_ROWS.length : step;

  // Les lignes cochées remontent en tête, dans leur ordre d'ajout.
  const ordered = [...FAVORITE_ROWS].sort((a, b) => {
    const rankA = FAVORITE_ROWS.indexOf(a) < starred ? 0 : 1;
    const rankB = FAVORITE_ROWS.indexOf(b) < starred ? 0 : 1;
    return rankA - rankB;
  });

  return (
    <SceneFrame tint={["bg-amber-400/30", "bg-primary/25", "bg-yellow-300/20"]}>
      <div className="flex w-full max-w-[17rem] flex-col gap-1 rounded-2xl border border-border/60 bg-card/85 p-2 shadow-sm backdrop-blur-sm">
        {ordered.map((row) => {
          const isStarred = FAVORITE_ROWS.indexOf(row) < starred;
          return (
            <motion.div
              key={row.id}
              layout
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className={cn(
                "flex items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-medium transition-colors",
                isStarred && "bg-primary/10",
              )}
            >
              <row.icon
                className={cn(
                  "size-3.5 shrink-0",
                  isStarred ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span className="flex-1 truncate">{row.label}</span>
              <motion.span
                animate={
                  isStarred && !still
                    ? { scale: [1, 1.45, 1], rotate: [0, 14, 0] }
                    : { scale: 1, rotate: 0 }
                }
                transition={{ duration: 0.45, ease: "easeOut" }}
              >
                <Star
                  className={cn(
                    "size-4 transition-colors",
                    isStarred
                      ? "fill-primary text-primary"
                      : "text-muted-foreground/40",
                  )}
                />
              </motion.span>
            </motion.div>
          );
        })}
      </div>
    </SceneFrame>
  );
}

/* ========================================================================== */
/* 3. Les notifications — elles tombent sur un téléphone                       */
/* ========================================================================== */

const PUSH_CARDS = [
  { id: "threshold", title: "Fury 325", icon: Timer, accent: "text-green-600" },
  {
    id: "reopened",
    title: "Voltron Nevera",
    icon: RotateCcw,
    accent: "text-primary",
  },
  {
    id: "show",
    title: "Festival of the Lion King",
    icon: CalendarClock,
    accent: "text-show",
  },
] as const;

export function NotificationsScene() {
  const t = useTranslations("whatsNew.scenes.notifications");
  const still = useStillness();
  const index = useLoop(PUSH_CARDS.length, 2800, !still);
  const card = PUSH_CARDS[index];

  return (
    <SceneFrame tint={["bg-primary/25", "bg-emerald-400/20", "bg-violet-400/25"]}>
      <div className="relative flex w-full max-w-[19rem] flex-col items-center">
        {/* La cloche sonne à chaque nouvelle notification (`key` = l'index :
            l'élément est remonté, donc l'animation d'entrée rejoue). */}
        <motion.span
          key={index}
          className="z-10 mb-2 flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg"
          initial={still ? false : { rotate: 0 }}
          animate={still ? undefined : { rotate: [0, -18, 14, -8, 0] }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        >
          <Bell className="size-5" />
        </motion.span>

        {/* La pile : deux cartes fantômes derrière, celle du dessus est la
            notification lisible. Le rendu d'un écran de verrouillage, sans avoir
            à dessiner un téléphone qui serait trop étroit pour porter du texte. */}
        <div className="relative w-full">
          <span className="absolute inset-x-6 -bottom-3 h-10 rounded-2xl border border-border/50 bg-card/50" />
          <span className="absolute inset-x-3 -bottom-1.5 h-10 rounded-2xl border border-border/60 bg-card/70" />

          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: -26, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="relative flex gap-2.5 rounded-2xl border border-border/60 bg-background/95 p-3 shadow-lg backdrop-blur-sm"
            >
              <Image
                src="/web-app-manifest-192x192.png"
                alt=""
                width={192}
                height={192}
                className="size-8 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="truncate text-xs font-semibold">
                    {card.title}
                  </span>
                  <card.icon className={cn("size-3 shrink-0", card.accent)} />
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  {t(card.id)}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </SceneFrame>
  );
}

/* ========================================================================== */
/* 4. Les prévisions — la courbe du jour, puis son prolongement                */
/* ========================================================================== */

// Deux tracés qui se rejoignent en `NOW_X` : l'observé (plein) et l'estimation
// (pointillé). Coordonnées dans un viewBox de 260 × 90.
const OBSERVED_PATH = "M8 72 L38 66 L68 52 L98 40 L128 30 L150 34";
const FORECAST_PATH = "M150 34 L178 22 L206 30 L232 46 L252 62";
const NOW_X = 150;

export function ForecastScene() {
  const t = useTranslations("attractionDetail");
  const still = useStillness();

  return (
    <SceneFrame tint={["bg-primary/25", "bg-sky-400/20", "bg-emerald-400/20"]}>
      <div className="w-full max-w-[19rem] rounded-2xl border border-border/60 bg-card/85 p-3 shadow-sm backdrop-blur-sm">
        <svg viewBox="0 0 260 90" className="w-full" role="presentation">
          {/* Grille : trois repères, assez pâles pour ne pas concurrencer la
              courbe. */}
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

          {/* Aire sous la courbe observée. */}
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

          {/* ⚠️ PAS de `pathLength` animé ici : pour dessiner un tracé
              progressivement, motion pilote `strokeDasharray` — et écrase donc
              le pointillé, qui est justement ce qui distingue l'estimation de
              l'observé. Le prolongement se révèle en fondu à la place. */}
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

          {/* Repère « maintenant » : la césure entre observé et estimé. */}
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

        <div className="mt-1 flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 rounded bg-primary" />
            {t("chartToday")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 border-t-2 border-dashed border-primary/60" />
            {t("chartForecast")}
          </span>
        </div>
      </div>
    </SceneFrame>
  );
}

/* ========================================================================== */
/* 5. La fiche détaillée — la ligne s'ouvre                                    */
/* ========================================================================== */

export function DetailScene() {
  const still = useStillness();
  const banners = useSceneBanners();
  // Cycle ASYMÉTRIQUE (un quart fermé, trois quarts ouvert) : à parts égales,
  // une carte sur deux tombait sur l'état replié, où la scène n'a presque rien
  // à montrer. C'est la fiche qu'on vient voir.
  const open = useLoop(4, 1100, !still) !== 0 || still;

  return (
    <SceneFrame tint={["bg-violet-400/25", "bg-primary/25", "bg-sky-400/20"]}>
      <div className="w-full max-w-[17rem]">
        {/* La ligne de la liste des temps d'attente, celle qu'on touche. */}
        <motion.div
          layout
          className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/85 px-2.5 py-2 text-xs shadow-sm backdrop-blur-sm"
        >
          <span className="flex-1 truncate font-medium">Taron</span>
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
            35 min
          </span>
        </motion.div>

        {/* La fiche qui s'ouvre. ⚠️ Recopie du VRAI en-tête de popup
            (`components/parks/attraction-detail/image-section.tsx`) : bannière
            de l'attraction, dégradé sur le tiers bas, nom en blanc ferré à
            gauche. Une illustration inventée apprendrait à reconnaître un écran
            qui n'existe pas. Le quartier prend la place qu'occupait le lien
            externe ; ni statut ni étoile, ils ne sont pas là non plus.

            ⚠️ **La photo est celle que Phantasialand publie pour Taron**, pas
            la couverture de repli de Queue Park : une fiche d'attraction montre
            l'attraction. Elle arrive signée par le serveur (`banners.ts`).

            ⚠️ **« MYSTERY » est le quartier que la SOURCE publie** pour cette
            attraction, pas un décor choisi : c'est mot pour mot ce que la vraie
            fiche affiche. Steel Vengeance, elle, aurait montré « Zone 4 Rides »
            — le libellé de rangement du CMS de Cedar Point. */}
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -8 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              className="overflow-hidden"
            >
              <div className="relative mt-1.5 h-24 overflow-hidden rounded-xl border border-border/60 shadow-sm">
                <Image
                  src={banners.ride}
                  alt=""
                  fill
                  sizes="272px"
                  className="object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/80 via-black/40 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-0.5 px-3 pb-2">
                  <p className="text-sm font-bold text-white drop-shadow-sm">
                    Taron
                  </p>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white/90 drop-shadow-sm">
                    <MapPin className="size-3" />
                    MYSTERY
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SceneFrame>
  );
}

/* ========================================================================== */
/* 6. Les événements saisonniers — la carte change de saison                   */
/* ========================================================================== */

// Rouge pour Halloween, bleu givré pour Noël : les MÊMES familles de couleur
// que les vraies cartes d'événement (`components/parks/event-accents.tsx`). Une
// annonce qui montrerait d'autres teintes désapprendrait le repère qu'elle
// installe — les deux fichiers doivent donc bouger ensemble.
const SEASONS = [
  {
    id: "halloween",
    icon: Ghost,
    card: "border-red-300/60 bg-red-50/80 dark:border-red-400/40 dark:bg-red-400/15",
    text: "text-red-700 dark:text-red-300",
    particle: "bg-red-400/60",
  },
  {
    id: "christmas",
    icon: Gift,
    card: "border-sky-300/60 bg-sky-50/80 dark:border-sky-400/40 dark:bg-sky-400/15",
    text: "text-sky-700 dark:text-sky-300",
    particle: "bg-sky-300/80",
  },
] as const;

// Chutes déterministes : 9 particules, réparties à pas irrégulier pour ne pas
// dessiner une grille.
const PARTICLES = Array.from({ length: 9 }, (_, index) => ({
  left: `${6 + index * 10.5}%`,
  delay: (index % 5) * 0.55,
  duration: 4 + (index % 3),
}));

export function EventsScene() {
  const t = useTranslations("whatsNew.scenes.events");
  const tEvents = useTranslations("events");
  const still = useStillness();
  const index = useLoop(SEASONS.length, 3400, !still);
  const season = SEASONS[index];

  // ⚠️ Les particules changent de couleur EN RETARD, le temps que la carte
  // finisse sa transition : hors de l'`AnimatePresence`, elles viraient au
  // bleu givré alors que la carte affichait encore Halloween.
  const [fallingIndex, setFallingIndex] = useState(0);
  useEffect(() => {
    // 600 ms : la carte sort (0,45 s) puis entre — la neige ne change de
    // couleur qu'une fois la nouvelle saison réellement à l'écran.
    const id = setTimeout(() => setFallingIndex(index), 600);
    return () => clearTimeout(id);
  }, [index]);

  return (
    <SceneFrame tint={["bg-red-400/20", "bg-sky-400/25", "bg-primary/20"]}>
      {!still && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {PARTICLES.map((particle, position) => (
            <motion.span
              key={position}
              className={cn(
                "absolute -top-2 size-1.5 rounded-full",
                SEASONS[fallingIndex].particle,
              )}
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

      <AnimatePresence mode="wait">
        <motion.div
          key={season.id}
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.97 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className={cn(
            "w-full max-w-[17rem] rounded-2xl border p-3 shadow-sm backdrop-blur-sm",
            season.card,
          )}
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-xl bg-background/70",
                season.text,
              )}
            >
              <season.icon className="size-4" />
            </span>
            <span className={cn("text-sm font-semibold", season.text)}>
              {t(season.id)}
            </span>
            <span className="ms-auto rounded-full bg-background/70 px-2 py-0.5 text-[9px] font-medium text-muted-foreground">
              {tEvents("separateTicket")}
            </span>
          </div>

          <div className="mt-2.5 space-y-1.5">
            {[0, 1].map((row) => (
              <div key={row} className="flex items-center gap-2">
                <span className="h-1.5 flex-1 rounded-full bg-foreground/10" />
                <span className="h-3.5 w-9 rounded-full bg-background/80" />
              </div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </SceneFrame>
  );
}

/* ========================================================================== */
/* 7. La météo — le ciel du parc, en direct                                    */
/* ========================================================================== */

const SKIES = [
  { id: "clear", icon: Sun, temp: 24, color: "text-amber-500" },
  { id: "partlyCloudy", icon: CloudSun, temp: 19, color: "text-sky-500" },
  { id: "rain", icon: CloudRain, temp: 14, color: "text-blue-500" },
] as const;

export function WeatherScene() {
  const tStatus = useTranslations("parkStatus");
  const still = useStillness();
  const banners = useSceneBanners();
  const index = useLoop(SKIES.length, 2600, !still);
  const sky = SKIES[index];

  return (
    <SceneFrame tint={["bg-sky-400/30", "bg-primary/20", "bg-blue-300/25"]}>
      {/* ⚠️ Recopie du VRAI en-tête de parc (`components/parks/header.tsx`) :
          bannière, mêmes dégradés, et en bas à gauche la pastille d'état, le
          nom, puis l'heure sur place et la météo sur une même ligne séparées
          d'une puce. C'est l'endroit où il faudra la chercher : une vignette
          météo inventée ne l'apprendrait à personne.

          ⚠️ **La photo est la VRAIE couverture de Cedar Point**, celle que sert
          `cdn.queue-park.com` sur la page du parc — pas la couverture de repli.
          L'heure affichée (10:24) est celle de l'Ohio à l'ouverture, pas la
          nôtre : l'en-tête donne l'heure SUR PLACE, c'est justement ce que la
          scène montre. */}
      <div className="relative h-28 w-full max-w-[19rem] overflow-hidden rounded-2xl border border-white/10 shadow-sm">
        <Image
          src={banners.park}
          alt=""
          fill
          sizes="304px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-r from-black/80 via-black/45 to-black/20" />
        <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-black/20" />

        <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-1 p-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-800">
            <span className="size-1.5 rounded-full bg-green-400" />
            {tStatus("open")}
          </span>

          <p className="text-base font-bold leading-tight text-white">
            Cedar Point
          </p>

          <div className="flex items-center gap-1.5 text-[11px] text-white">
            <Clock className="size-3" />
            <span className="tabular-nums">10:24</span>
            <span aria-hidden>•</span>

            {/* La météo, désignée par un halo : c'est elle, la nouveauté, dans
                un en-tête qui portait déjà l'état, les horaires et l'heure. */}
            <motion.span
              className="relative -mx-1 flex items-center gap-1.5 rounded-full px-1.5 py-0.5"
              animate={
                still
                  ? undefined
                  : {
                      backgroundColor: [
                        "rgba(255,255,255,0)",
                        "rgba(255,255,255,0.18)",
                        "rgba(255,255,255,0)",
                      ],
                    }
              }
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={sky.id}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.32, ease: "easeOut" }}
                  className="flex items-center gap-1.5"
                >
                  <sky.icon className="size-3.5 shrink-0" />
                  <span className="tabular-nums">{sky.temp}°C</span>
                </motion.span>
              </AnimatePresence>
            </motion.span>
          </div>
        </div>
      </div>
    </SceneFrame>
  );
}

/* ========================================================================== */
/* 8. Clôture — confettis                                                      */
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
            v3
          </span>
        </span>
      </motion.div>
    </SceneFrame>
  );
}
