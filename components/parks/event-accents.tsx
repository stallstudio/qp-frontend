import { Ghost, Gift, Sparkles, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// ————————————————————————————————————————————————————————————————————————
// HABILLAGE DES CARTES D'ÉVÉNEMENT
//
// ⚠️ **Une identité par FAMILLE, jamais par événement.** Les sources publient
// bien une couleur par opération (CDA notamment), mais les empiler dans une même
// page produirait un dégradé arbitraire au lieu de deux familles qu'on
// reconnaît. Halloween est rouge, Noël est vert, et c'est tout.
//
// ⚠️ **Volontairement SOBRE.** Une version antérieure posait un décor animé —
// braises pulsantes pour Halloween, givre et fissures pour Noël. Écarté après
// essai : la carte est repliée la plupart du temps, posée au-dessus d'une liste
// de temps d'attente qu'on vient lire, et un décor chargé y devient une gêne
// avant de devenir un repère. Il reste un simple APLAT teinté, qui suffit à
// distinguer la carte de celles qui l'entourent. Le dégradé lui-même (fond puis
// liseré) a été essayé et retiré : sur une carte large et peu haute, il se lit
// comme une inégalité d'éclairage, pas comme une intention.
//
// ⚠️ **En thème sombre, on remonte la RAMPE au lieu de la descendre.** Le
// réflexe `red-50` clair / `red-950` sombre donnait une carte BRUNE : au bas de
// la rampe, Tailwind vire au brun sombre (`red-950` = #450a0a), et un brun posé
// sur un fond sombre ne se lit plus comme du rouge. Le sombre prend donc une
// teinte CLAIRE (400), franchement rouge, et c'est l'OPACITÉ qui la rend
// discrète — deux réglages indépendants, là où descendre la rampe mélangeait
// « plus sombre » et « moins présent » dans un seul chiffre. Même logique pour
// le vert.
//
// ⚠️ Contrat partagé avec `tw-waittimes-admin/components/parks/event-accent.tsx`,
// qui recopie les teintes pour que le réglage se voie avant d'être enregistré.
// Les CLÉS (`halloween`, `christmas`) sont celles que le worker devine depuis le
// nom de l'événement (`guessAccent`).
// ————————————————————————————————————————————————————————————————————————

export type AccentStyle = {
  icon: LucideIcon;
  /** Bordure et fond de la carte. */
  card: string;
  /** Couleur de l'icône. */
  iconClass: string;
};

// ————— La surface OPAQUE de la carte (`--table-surface`) —————
//
// Le fond d'une carte d'événement est un VOILE : `bg-red-400/12` posé sur le
// fond de page. Un contenu qui a besoin d'un fond opaque ne peut donc pas s'y
// fondre en réutilisant un token — c'est ce qui donnait, dans la grille des
// spectacles, une colonne de noms GRISE plaquée au milieu d'une carte teintée :
// elle porte `bg-card` parce qu'elle est `sticky`, et qu'un fond translucide
// laisserait défiler les créneaux dessous.
//
// D'où cette variable : la MÊME teinte, mais aplatie sur le fond de page. Les
// deux écritures restent côte à côte, dans le même objet, pour qu'un changement
// de teinte se voie tout de suite dans les deux.
//
// ⚠️ `in srgb`, et pas `in oklab` : on ne cherche pas un joli mélange, on
// REPRODUIT ce que le navigateur fait déjà en composant `bg-red-400/12` sur
// le fond de page — et cette composition-là se fait en sRGB. Mélanger en oklab
// donnerait une teinte voisine, donc une colonne légèrement décalée du reste de
// la carte : le défaut qu'on corrige, en plus discret.
//
// ⚠️ Écrites EN TOUTES LETTRES, comme les rayons du sélecteur d'onglets :
// Tailwind scanne les sources comme du texte, une classe assemblée par template
// literal n'existerait tout simplement pas dans le CSS produit — sans erreur au
// build.
const ACCENT_STYLES: Record<string, AccentStyle> = {
  halloween: {
    icon: Ghost,
    card: cn(
      "border-red-300/60 bg-red-50/70 dark:border-red-400/40 dark:bg-red-400/12",
      "[--table-surface:color-mix(in_srgb,var(--color-red-50)_70%,var(--background))]",
      "dark:[--table-surface:color-mix(in_srgb,var(--color-red-400)_12%,var(--background))]",
    ),
    iconClass: "text-red-700 dark:text-red-300",
  },
  christmas: {
    icon: Gift,
    card: cn(
      "border-emerald-300/60 bg-emerald-50/70 dark:border-emerald-400/40 dark:bg-emerald-400/12",
      "[--table-surface:color-mix(in_srgb,var(--color-emerald-50)_70%,var(--background))]",
      "dark:[--table-surface:color-mix(in_srgb,var(--color-emerald-400)_12%,var(--background))]",
    ),
    iconClass: "text-emerald-700 dark:text-emerald-300",
  },
};

/**
 * Habillage d'un accent, avec un repli NEUTRE.
 *
 * ⚠️ Le repli n'est pas une précaution théorique : `accent` est une colonne de
 * texte que le worker remplit en devinant depuis le nom de l'événement. Une
 * valeur inattendue doit donner une carte sobre, jamais un rendu cassé — c'est
 * le même piège que `typeIconMap` dans l'en-tête des horaires, qui plantait le
 * rendu React sur un type absent de sa table.
 */
export function accentStyle(accent: string | null | undefined): AccentStyle {
  return (
    ACCENT_STYLES[accent ?? ""] ?? {
      icon: Sparkles,
      card: "",
      iconClass: "text-muted-foreground",
    }
  );
}
