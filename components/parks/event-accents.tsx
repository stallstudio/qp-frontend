import { Ghost, Gift, Sparkles, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// ————————————————————————————————————————————————————————————————————————
// HABILLAGE DES CARTES D'ÉVÉNEMENT
//
// ⚠️ **Une identité par FAMILLE, jamais par événement.** Les sources publient
// bien une couleur par opération (CDA notamment), mais les empiler dans une même
// page produirait un dégradé arbitraire au lieu de deux familles qu'on
// reconnaît. Halloween est rouge, Noël est bleu givré, et c'est tout.
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
//
// ————— Le fond d'une LIGNE (`--table-row-accent`, `--table-row-hover`) —————
//
// Même histoire que ci-dessus, un cran plus bas : les listes allument une ligne
// au survol, et la font clignoter quand sa valeur vient de changer. Les deux
// tenaient sur `bg-accent`, un GRIS — posé dans une carte rouge, il se lit comme
// une ligne désactivée, pas comme une ligne mise en avant. Les valeurs par
// défaut vivent dans `app/globals.css` (`:root`) et reproduisent exactement
// l'ancien gris ; seules les cartes d'événement les redéfinissent.
//
// ⚠️ Le mélange se fait avec `transparent`, pas avec le fond : contrairement à
// `--table-surface`, cette teinte est un VOILE DE PLUS posé sur celui de la
// carte. L'aplatir sur `--background` la ferait passer devant lui, et une ligne
// surlignée serait alors PLUS PÂLE que la carte qui la porte.
//
// ⚠️ La rampe monte d'un cran par rapport à la carte (500 en clair, 400 en
// sombre, contre 50/400 pour le fond) : la ligne doit se détacher du voile
// qu'elle recouvre, sinon le clignotement de changement passe inaperçu — c'est
// la seule chose qu'il ait à faire.
//
// ————— Les pastilles du sélecteur de famille (`--tint-*`) —————
//
// Les MÊMES couleurs que dans les cartes ordinaires, TERNIES par la teinte de
// l'événement : chaque famille garde la sienne — le vert reste le vert des
// restaurants —, mais un vert de Halloween, qui tient sur le voile rouge au lieu
// d'y crier. Lues par `family-switcher.tsx`, qui retombe sur la couleur franche
// partout ailleurs.
//
// ⚠️ **Mélange en `oklab`**, et c'est ce qui ternit : le rouge et le vert y
// sont presque opposés, leur mélange perd de la saturation au lieu de virer à
// une troisième teinte (en `oklch`, le vert passerait par le jaune). Un quart
// d'accent seulement : au-delà, le violet des spectacles et le bleu des
// boutiques se confondent.
//
// ⚠️ **L'accent change de sens avec le thème**, pour la même raison que les
// textes posés dessus : en clair, les pastilles portent du texte BLANC et
// s'assombrissent (rouge 900) ; en sombre, elles portent du texte foncé et
// restent claires (rouge 400). Ternir dans le mauvais sens écrasait le
// contraste du libellé.
//
// `--tint-idle` : le fond des pastilles inactives, un voile de l'accent au lieu
// du gris `muted`.
const ACCENT_STYLES: Record<string, AccentStyle> = {
  halloween: {
    icon: Ghost,
    card: cn(
      "border-red-300/60 bg-red-50/70 dark:border-red-400/40 dark:bg-red-400/12",
      "[--table-surface:color-mix(in_srgb,var(--color-red-50)_70%,var(--background))]",
      "dark:[--table-surface:color-mix(in_srgb,var(--color-red-400)_12%,var(--background))]",
      "[--table-row-accent:color-mix(in_srgb,var(--color-red-500)_12%,transparent)]",
      "[--table-row-hover:color-mix(in_srgb,var(--color-red-500)_6%,transparent)]",
      "dark:[--table-row-accent:color-mix(in_srgb,var(--color-red-400)_20%,transparent)]",
      "dark:[--table-row-hover:color-mix(in_srgb,var(--color-red-400)_10%,transparent)]",
      "[--tint-ride:color-mix(in_oklab,var(--primary)_75%,var(--color-red-900))]",
      "[--tint-show:color-mix(in_oklab,var(--show)_75%,var(--color-red-900))]",
      "[--tint-restaurant:color-mix(in_oklab,var(--restaurant)_75%,var(--color-red-900))]",
      "[--tint-shop:color-mix(in_oklab,var(--shop)_75%,var(--color-red-900))]",
      "[--tint-hotel:color-mix(in_oklab,var(--hotel)_75%,var(--color-red-900))]",
      "[--tint-service:color-mix(in_oklab,var(--service)_75%,var(--color-red-900))]",
      "dark:[--tint-ride:color-mix(in_oklab,var(--primary)_75%,var(--color-red-400))]",
      "dark:[--tint-show:color-mix(in_oklab,var(--show)_75%,var(--color-red-400))]",
      "dark:[--tint-restaurant:color-mix(in_oklab,var(--restaurant)_75%,var(--color-red-400))]",
      "dark:[--tint-shop:color-mix(in_oklab,var(--shop)_75%,var(--color-red-400))]",
      "dark:[--tint-hotel:color-mix(in_oklab,var(--hotel)_75%,var(--color-red-400))]",
      "dark:[--tint-service:color-mix(in_oklab,var(--service)_75%,var(--color-red-400))]",
      "[--tint-idle:color-mix(in_srgb,var(--color-red-500)_10%,transparent)]",
      "dark:[--tint-idle:color-mix(in_srgb,var(--color-red-400)_14%,transparent)]",
    ),
    iconClass: "text-red-700 dark:text-red-300",
  },
  christmas: {
    icon: Gift,
    card: cn(
      "border-sky-300/60 bg-sky-50/70 dark:border-sky-400/40 dark:bg-sky-400/12",
      "[--table-surface:color-mix(in_srgb,var(--color-sky-50)_70%,var(--background))]",
      "dark:[--table-surface:color-mix(in_srgb,var(--color-sky-400)_12%,var(--background))]",
      "[--table-row-accent:color-mix(in_srgb,var(--color-sky-500)_12%,transparent)]",
      "[--table-row-hover:color-mix(in_srgb,var(--color-sky-500)_6%,transparent)]",
      "dark:[--table-row-accent:color-mix(in_srgb,var(--color-sky-400)_20%,transparent)]",
      "dark:[--table-row-hover:color-mix(in_srgb,var(--color-sky-400)_10%,transparent)]",
      "[--tint-ride:color-mix(in_oklab,var(--primary)_75%,var(--color-sky-900))]",
      "[--tint-show:color-mix(in_oklab,var(--show)_75%,var(--color-sky-900))]",
      "[--tint-restaurant:color-mix(in_oklab,var(--restaurant)_75%,var(--color-sky-900))]",
      "[--tint-shop:color-mix(in_oklab,var(--shop)_75%,var(--color-sky-900))]",
      "[--tint-hotel:color-mix(in_oklab,var(--hotel)_75%,var(--color-sky-900))]",
      "[--tint-service:color-mix(in_oklab,var(--service)_75%,var(--color-sky-900))]",
      "dark:[--tint-ride:color-mix(in_oklab,var(--primary)_75%,var(--color-sky-300))]",
      "dark:[--tint-show:color-mix(in_oklab,var(--show)_75%,var(--color-sky-300))]",
      "dark:[--tint-restaurant:color-mix(in_oklab,var(--restaurant)_75%,var(--color-sky-300))]",
      "dark:[--tint-shop:color-mix(in_oklab,var(--shop)_75%,var(--color-sky-300))]",
      "dark:[--tint-hotel:color-mix(in_oklab,var(--hotel)_75%,var(--color-sky-300))]",
      "dark:[--tint-service:color-mix(in_oklab,var(--service)_75%,var(--color-sky-300))]",
      "[--tint-idle:color-mix(in_srgb,var(--color-sky-500)_10%,transparent)]",
      "dark:[--tint-idle:color-mix(in_srgb,var(--color-sky-400)_14%,transparent)]",
    ),
    iconClass: "text-sky-700 dark:text-sky-300",
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
