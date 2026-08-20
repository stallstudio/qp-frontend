import { Ghost, Gift, Sparkles, type LucideIcon } from "lucide-react";

// ————————————————————————————————————————————————————————————————————————
// HABILLAGE DES CARTES D'ÉVÉNEMENT
//
// ⚠️ **Une identité par FAMILLE, jamais par événement.** Les sources publient
// bien une couleur par opération (CDA notamment), mais les empiler dans une même
// page produirait un dégradé arbitraire au lieu de deux familles qu'on
// reconnaît. Halloween est orange braise, Noël est bleu glace, et c'est tout.
//
// ⚠️ **L'effet vit dans l'EN-TÊTE, et il est volontairement discret.** La carte
// est repliée la plupart du temps, posée au-dessus d'une liste de temps
// d'attente qu'on vient lire : elle doit accrocher l'œil au premier coup d'œil
// puis se faire oublier. Tout ce qui est ici est donc en faible opacité, sans
// aucune transformation géométrique — que des dégradés et de l'opacité, donc
// aucun recalcul de mise en page, et rien qui puisse gêner la lecture du nom.
//
// ⚠️ Contrat partagé avec `tw-waittimes-admin/components/parks/event-accent.tsx`,
// qui recopie les teintes pour que le réglage se voie avant d'être enregistré.
// Les CLÉS (`halloween`, `christmas`) sont celles que le worker devine depuis le
// nom de l'événement (`guessAccent`).
// ————————————————————————————————————————————————————————————————————————

export type AccentStyle = {
  icon: LucideIcon;
  /** Bordure et fond de la carte entière. */
  card: string;
  /** Couleur de l'icône et de son halo. */
  iconClass: string;
  /** Décor rendu SOUS le contenu, en `pointer-events-none`. */
  decor: React.ReactNode;
};

/**
 * Fissures de glace.
 *
 * SVG INLINE plutôt qu'une data-URI en `background-image` : le tracé prend
 * `stroke="currentColor"`, donc sa couleur suit la classe Tailwind du parent et
 * s'adapte au thème sombre toute seule. Une data-URI aurait figé la couleur et
 * demandé deux variantes à garder d'accord.
 *
 * `preserveAspectRatio="none"` : le motif s'étire sur la largeur de la carte au
 * lieu de se répéter — sur une bande de 60 px de haut, une répétition se lirait
 * comme une frise, pas comme des fissures.
 */
function IceCracks() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full text-sky-500/25 dark:text-sky-200/20"
      viewBox="0 0 400 100"
      preserveAspectRatio="none"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
    >
      <path d="M18 0 L34 26 L22 41 L38 63 L30 100" />
      <path d="M34 26 L58 20" />
      <path d="M38 63 L60 72 L74 60" />
      <path d="M140 0 L128 22 L146 39 L136 62" />
      <path d="M146 39 L172 33 L188 47" />
      <path d="M268 100 L280 74 L266 55 L278 30 L270 0" />
      <path d="M266 55 L240 48" />
      <path d="M366 0 L352 28 L370 46 L358 72 L372 100" />
      <path d="M370 46 L392 40" />
      <path d="M352 28 L330 21" />
    </svg>
  );
}

export const ACCENT_STYLES: Record<string, AccentStyle> = {
  halloween: {
    icon: Ghost,
    card: "border-orange-400/50 bg-orange-50/60 dark:border-orange-900/60 dark:bg-orange-950/25",
    iconClass:
      "text-orange-600 drop-shadow-[0_0_6px_rgba(234,88,12,0.55)] dark:text-orange-400",
    decor: (
      <>
        {/* La braise : un halo chaud, décentré, qui respire lentement. Deux
            dégradés radiaux superposés donnent la profondeur qu'un seul aplat
            n'a pas — le second, plus rouge et plus bas, fait le fond du
            brasier. */}
        <div
          aria-hidden
          className="animate-ember pointer-events-none absolute inset-0 motion-reduce:animate-none"
          style={{
            background:
              "radial-gradient(120% 90% at 8% 0%, rgba(249,115,22,0.30), transparent 55%)," +
              "radial-gradient(90% 120% at 92% 110%, rgba(190,18,60,0.26), transparent 60%)",
          }}
        />
        {/* Vignette : assombrit les bords pour que le halo paraisse venir de
            l'intérieur de la carte plutôt que d'être posé dessus. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(120% 100% at 50% 50%, transparent 40%, rgba(69,10,10,0.16))",
          }}
        />
      </>
    ),
  },

  christmas: {
    icon: Gift,
    card: "border-sky-300/60 bg-sky-50/70 dark:border-sky-900/60 dark:bg-sky-950/30",
    iconClass:
      "text-sky-600 drop-shadow-[0_0_6px_rgba(14,165,233,0.5)] dark:text-sky-300",
    decor: (
      <>
        {/* Le givre : plus dense en haut, comme une plaque prise par le froid. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(186,230,253,0.45), transparent 70%)," +
              "radial-gradient(100% 80% at 100% 0%, rgba(224,242,254,0.5), transparent 60%)",
          }}
        />
        <IceCracks />
        {/* Le reflet qui glisse. Bande étroite et très pâle : sur du bleu clair,
            un balayage large virerait au clignotement. */}
        <div
          aria-hidden
          className="animate-frost pointer-events-none absolute inset-0 motion-reduce:animate-none"
          style={{
            backgroundImage:
              "linear-gradient(105deg, transparent 42%, rgba(255,255,255,0.55) 50%, transparent 58%)",
            backgroundSize: "220% 100%",
            backgroundRepeat: "no-repeat",
          }}
        />
      </>
    ),
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
      decor: null,
    }
  );
}
