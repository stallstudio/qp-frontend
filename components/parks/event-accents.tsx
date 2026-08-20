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
// avant de devenir un repère. Il reste un simple dégradé, qui suffit à
// distinguer la carte de celles qui l'entourent.
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
    card: "border-orange-300/60 bg-gradient-to-br from-orange-50/80 to-orange-100/50 dark:border-orange-900/50 dark:from-orange-950/25 dark:to-orange-900/10",
    iconClass: "text-orange-700 dark:text-orange-300",
  },
  christmas: {
    icon: Gift,
    card: "border-emerald-300/60 bg-gradient-to-br from-emerald-50/80 to-emerald-100/50 dark:border-emerald-900/50 dark:from-emerald-950/25 dark:to-emerald-900/10",
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
