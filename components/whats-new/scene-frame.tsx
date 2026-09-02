"use client";

import { createContext, useContext } from "react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

// ————————————————————————————————————————————————————————————————————————
// LE CADRE COMMUN DES SCÈNES DE L'ANNONCE DE VERSION
//
// Chaque nouveauté est illustrée par une petite « scène » vivante. Toutes
// partagent le même décor : trois taches de couleur floues qui dérivent
// lentement (une aurore), un grain, et un dégradé vers le fond sur lequel elles
// sont posées, pour que le texte qui suit ne semble pas plaqué sur une image.
//
// ⚠️ **La teinte change d'une scène à l'autre, pas la construction.** C'est ce
// qui donne l'impression d'un ensemble : on reconnaît le même décor, on voit
// qu'on a changé de sujet. Les couleurs sont passées en classes Tailwind
// ENTIÈRES (pas assemblées) — Tailwind scanne les sources comme du texte, une
// classe construite par template literal n'existerait pas dans le CSS produit.
//
// ⚠️ **`prefers-reduced-motion` coupe la dérive**, pas le décor : l'aurore
// s'immobilise, les couleurs restent. Même règle dans toutes les scènes.
// ————————————————————————————————————————————————————————————————————————

type SceneContextValue = {
  /**
   * La scène est-elle à l'écran ? Sept décors qui dérivent en même temps, plus
   * leurs boucles, c'est du travail continu pour rien : hors champ, tout se fige.
   */
  active: boolean;
  /**
   * La couleur sur laquelle la scène est posée — celle vers laquelle son bas
   * doit se fondre. `background` (le dialog lui-même) ou `card` (une carte de
   * nouveauté). Les deux sont blanches en thème clair ; l'écart ne se voit qu'en
   * sombre, où `card` est plus clair.
   */
  surface: "background" | "card";
};

const SceneContext = createContext<SceneContextValue>({
  active: true,
  surface: "background",
});

export function useSceneContext(): SceneContextValue {
  return useContext(SceneContext);
}

/**
 * Les deux vraies photos que portent les scènes (voir `banners.ts`).
 *
 * ⚠️ **Un contexte, et non des props de scène** : la liste des nouveautés
 * (`FEATURES` dans `whats-new-dialog.tsx`) rend chaque scène comme un
 * `() => JSX.Element`, sans rien lui passer. Deux scènes sur neuf ont besoin
 * d'une image ; leur ouvrir un tuyau de props à travers toute la liste
 * coûterait plus cher que ce contexte.
 *
 * ⚠️ Le repli n'est PAS décoratif : hors du dialog (un test, un rendu isolé),
 * les scènes doivent continuer à s'afficher — avec la photo de repli de Queue
 * Park, comme avant.
 */
type SceneBannersValue = { ride: string; park: string };

const DEFAULT_BANNERS: SceneBannersValue = {
  ride: "/default_cover.webp",
  park: "/default_cover.webp",
};

const BannersContext = createContext<SceneBannersValue>(DEFAULT_BANNERS);

export function useSceneBanners(): SceneBannersValue {
  return useContext(BannersContext);
}

/** Pose les images signées par le serveur pour toutes les scènes du dialog. */
export function SceneBanners({
  value,
  children,
}: {
  value: SceneBannersValue | null;
  children: React.ReactNode;
}) {
  return (
    <BannersContext.Provider value={value ?? DEFAULT_BANNERS}>
      {children}
    </BannersContext.Provider>
  );
}

/** Enveloppe une scène pour lui dire où elle est posée, et si on la regarde. */
export function SceneActivity({
  active = true,
  surface = "background",
  children,
}: Partial<SceneContextValue> & { children: React.ReactNode }) {
  return (
    <SceneContext.Provider value={{ active, surface }}>
      {children}
    </SceneContext.Provider>
  );
}

// Grain léger : casse le côté « dégradé plastique » des grands aplats flous.
// Généré une fois, en data-URI, pour éviter une requête réseau sur un décor.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

// Position, taille et amplitude de dérive des trois taches. Fixées à la main :
// une tache haute à gauche, une basse à droite, une petite au centre qui respire.
const BLOBS = [
  {
    className: "-left-10 -top-16 size-52",
    drift: { x: [0, 26, 0], y: [0, 18, 0], scale: [1, 1.12, 1] },
    duration: 14,
  },
  {
    className: "-right-12 -bottom-20 size-56",
    drift: { x: [0, -22, 0], y: [0, -16, 0], scale: [1, 1.08, 1] },
    duration: 18,
  },
  {
    className: "left-1/2 top-1/4 size-40 -translate-x-1/2",
    drift: { x: ["-50%", "-38%", "-50%"], y: [0, 14, 0], scale: [1, 1.15, 1] },
    duration: 22,
  },
];

export type SceneTint = [string, string, string];

/** Teintes par défaut : l'orange de la marque, réchauffé. */
export const DEFAULT_TINT: SceneTint = [
  "bg-primary/30",
  "bg-amber-400/25",
  "bg-rose-400/20",
];

export default function SceneFrame({
  tint = DEFAULT_TINT,
  children,
  className,
}: {
  tint?: SceneTint;
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const { active, surface } = useSceneContext();
  const still = reduce || !active;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* ————— Décor (purement visuel) ————— */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {BLOBS.map((blob, index) => (
          <motion.div
            key={index}
            className={cn(
              "absolute rounded-full blur-3xl",
              blob.className,
              tint[index],
            )}
            animate={still ? undefined : blob.drift}
            transition={{
              duration: blob.duration,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
        <div
          className="absolute inset-0 opacity-[0.22] mix-blend-overlay dark:opacity-[0.14]"
          style={{ backgroundImage: GRAIN }}
        />
        {/* Raccord avec ce qui suit : la scène ne s'arrête pas net. */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 h-16 bg-linear-to-t to-transparent",
            surface === "card" ? "from-card" : "from-background",
          )}
        />
      </div>

      {/* ————— Contenu de la scène ————— */}
      <div
        aria-hidden
        className={cn(
          "relative flex h-full w-full items-center justify-center px-6",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
