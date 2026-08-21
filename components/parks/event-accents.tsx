import { Ghost, Gift, Sparkles, type LucideIcon } from "lucide-react";

// ————————————————————————————————————————————————————————————————————————
// HABILLAGE DES CARTES D'ÉVÉNEMENT
//
// ⚠️ **Une identité par FAMILLE, jamais par événement.** Les sources publient
// bien une couleur par opération (CDA notamment), mais les empiler dans une même
// page produirait un dégradé arbitraire au lieu de deux familles qu'on
// reconnaît. Halloween est orange, Noël est vert, et c'est tout.
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
// réflexe `orange-50` clair / `orange-950` sombre donnait une carte ROUGE :
// aux deux extrémités de la rampe, Tailwind vire au brun-rouge (`orange-950` =
// #431407), et un brun posé sur un fond sombre ne se lit plus comme de l'orange.
// Le sombre prend donc une teinte CLAIRE (400), franchement orange, et c'est
// l'OPACITÉ qui la rend discrète — deux réglages indépendants, là où descendre
// la rampe mélangeait « plus sombre » et « moins présent » dans un seul chiffre.
// Même logique pour le vert.
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

const ACCENT_STYLES: Record<string, AccentStyle> = {
  halloween: {
    icon: Ghost,
    card: "border-orange-300/60 bg-orange-50/70 dark:border-orange-400/40 dark:bg-orange-400/12",
    iconClass: "text-orange-700 dark:text-orange-300",
  },
  christmas: {
    icon: Gift,
    card: "border-emerald-300/60 bg-emerald-50/70 dark:border-emerald-400/40 dark:bg-emerald-400/12",
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
