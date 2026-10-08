"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ParkFamily } from "@/lib/poi-kinds";

export type FamilyOption = {
  family: ParkFamily;
  label: string;
  icon: LucideIcon;
};

type FamilySwitcherProps = {
  options: FamilyOption[];
  value: ParkFamily;
  onChange: (family: ParkFamily) => void;
  ariaLabel: string;
  /** Préfixe des `id` des pastilles, que le panneau cite dans `aria-labelledby`. */
  idPrefix: string;
  /** `id` du panneau que la pastille active commande. */
  panelId: string;
};

// La teinte de chaque famille, posée en variables sur sa pastille : `--fam` pour
// le fond actif, `--fam-fg` pour ce qu'il porte. Orange et violet sont ceux du
// profil (alertes d'attraction, rappels de spectacle) ; les autres sont définis
// à côté d'eux dans `globals.css`.
//
// ⚠️ Des chaînes ENTIÈRES, jamais assemblées : Tailwind ne génère que les
// classes qu'il lit telles quelles dans le source.
//
// ⚠️ **Chaque teinte passe d'abord par `--tint-<famille>`**, que seule une carte
// d'événement définit (`event-accents.tsx`) : le sélecteur posé dans la carte
// de Halloween y prend le vert mousse de sa palette au lieu du vert franc des
// restaurants, sans connaître la carte qui le porte. Ailleurs, la variable
// n'existe pas et le repli rend la teinte de toujours. Même chose pour le
// libellé de la pastille active (`--tint-fg` : les palettes d'événement sont
// sourdes et portent un texte CLAIR, là où les couleurs franches du thème
// sombre en portent un foncé) et pour la pastille inactive (`--tint-idle`,
// `--tint-idle-fg`), dont le gris se lisait comme une pastille désactivée sur
// le voile rouge.
const FAMILY_TINT: Record<ParkFamily, string> = {
  ride: "[--fam:var(--tint-ride,var(--primary))] [--fam-fg:var(--tint-fg,var(--primary-foreground))]",
  show: "[--fam:var(--tint-show,var(--show))] [--fam-fg:var(--tint-fg,var(--show-foreground))]",
  restaurant:
    "[--fam:var(--tint-restaurant,var(--restaurant))] [--fam-fg:var(--tint-fg,var(--restaurant-foreground))]",
  shop: "[--fam:var(--tint-shop,var(--shop))] [--fam-fg:var(--tint-fg,var(--shop-foreground))]",
  hotel: "[--fam:var(--tint-hotel,var(--hotel))] [--fam-fg:var(--tint-fg,var(--hotel-foreground))]",
  service:
    "[--fam:var(--tint-service,var(--service))] [--fam-fg:var(--tint-fg,var(--service-foreground))]",
};

// Ressort de la pastille qui s'ouvre et de celle qui se referme : assez vif
// pour suivre le doigt, un léger rebond pour qu'on le sente arriver.
const PILL_SPRING = { type: "spring", bounce: 0.22, duration: 0.5 } as const;

/**
 * Sélecteur de famille de la page d'un parc, façon catégories de Mail sur iOS :
 * la pastille choisie se teinte de la couleur de sa famille et dévoile son
 * libellé, les autres restent des pictogrammes gris.
 *
 * ⚠️ **Le libellé des pastilles inactives est replié, pas retiré.** Sa largeur
 * tombe à zéro mais le texte reste dans le DOM : c'est lui qui donne son nom
 * accessible à chaque pastille, sans `aria-label` à tenir en double. Et c'est ce
 * qui permet d'ANIMER sa largeur réelle, plutôt qu'une échelle : le texte ne se
 * déforme jamais, et les voisines glissent d'elles-mêmes, image par image.
 *
 * ⚠️ **Sémantique d'onglets ARIA**, avec focus itinérant : une seule pastille
 * dans l'ordre de tabulation, les flèches passent d'une famille à l'autre et la
 * sélectionnent aussitôt — c'est ce que fait la rangée d'onglets juste au-dessus
 * (Radix), et deux sélecteurs voisins ne peuvent pas se piloter différemment.
 */
export default function FamilySwitcher({
  options,
  value,
  onChange,
  ariaLabel,
  idPrefix,
  panelId,
}: FamilySwitcherProps) {
  const reduceMotion = useReducedMotion();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef(new Map<ParkFamily, HTMLButtonElement>());
  const isFirstRender = useRef(true);

  // Si la rangée déborde (petits écrans, langues aux libellés longs), ramène la
  // pastille choisie dans le champ.
  //
  // ⚠️ Défilement HORIZONTAL de la rangée seulement, jamais `scrollIntoView` :
  // celui-ci fait aussi défiler la PAGE dès que la pastille passe sous l'en-tête
  // fixe du parc, et la page sauterait à chaque changement de famille.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const scroller = scrollerRef.current;
    const pill = pillRefs.current.get(value);
    if (!scroller || !pill || scroller.scrollWidth <= scroller.clientWidth) {
      return;
    }
    scroller.scrollTo({
      left: pill.offsetLeft + pill.offsetWidth / 2 - scroller.clientWidth / 2,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [value, reduceMotion]);

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    const last = options.length - 1;
    let next: number;
    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    const family = options[next].family;
    onChange(family);
    pillRefs.current.get(family)?.focus();
  };

  return (
    // `-my-2 py-2` : la rangée défile horizontalement, donc elle rogne aussi à
    // la verticale — sans cette marge, l'anneau de focus de la pastille serait
    // coupé net.
    <div
      ref={scrollerRef}
      role="tablist"
      aria-label={ariaLabel}
      className="-mx-1 -my-2 flex items-center gap-1.5 overflow-x-auto px-1 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {/* Une famille qui apparaît ou disparaît au fil des rafraîchissements
          (source rétablie, fin de journée) entre et sort en fondu ; `layout`
          fait glisser ses voisines.

          ⚠️ **Jamais `mode="popLayout"`** : rendu côté serveur, il décale les
          `useId` de toute la page — onglets Radix, dialogues, menu de langue —,
          et l'hydratation échoue sur chacun (constaté le 2026-10-06, motion
          12.34). Le mode par défaut n'a pas ce défaut. */}
      <AnimatePresence initial={false}>
        {options.map(({ family, label, icon: Icon }, index) => {
          const active = family === value;
          return (
            <motion.button
              key={family}
              ref={(el: HTMLButtonElement | null) => {
                if (el) pillRefs.current.set(family, el);
                else pillRefs.current.delete(family);
              }}
              type="button"
              role="tab"
              id={`${idPrefix}-${family}`}
              aria-selected={active}
              aria-controls={active ? panelId : undefined}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(family)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              layout="position"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              whileTap={reduceMotion ? undefined : { scale: 0.92 }}
              transition={PILL_SPRING}
              className={cn(
                "inline-flex h-9 shrink-0 cursor-pointer items-center rounded-full text-sm font-semibold outline-none select-none",
                "transition-[background-color,color,box-shadow,padding] duration-300 ease-out",
                "focus-visible:ring-[3px] focus-visible:ring-ring/50",
                FAMILY_TINT[family],
                active
                  ? // Aplat seul, sans halo coloré dessous (retiré le
                    // 2026-10-06) : la couleur suffit à désigner la pastille.
                    "bg-(--fam) px-4 text-(--fam-fg)"
                  : "bg-[var(--tint-idle,var(--muted))] px-3 text-[var(--tint-idle-fg,var(--muted-foreground))] hover:bg-foreground/10 hover:text-foreground",
              )}
            >
              {/* Petit sursaut du pictogramme à l'arrivée, rien au départ.
                  `initial={false}` : au premier rendu, la pastille active est
                  déjà là, elle n'a pas à s'annoncer. */}
              <motion.span
                aria-hidden
                className="grid place-items-center"
                initial={false}
                animate={
                  active && !reduceMotion
                    ? { scale: [1, 0.78, 1.12, 1], rotate: [0, -8, 4, 0] }
                    : { scale: 1, rotate: 0 }
                }
                transition={{
                  duration: 0.5,
                  times: [0, 0.2, 0.55, 1],
                  ease: "easeOut",
                }}
              >
                <Icon className="size-[18px]" />
              </motion.span>
              <motion.span
                className="overflow-hidden whitespace-nowrap"
                initial={false}
                animate={
                  active
                    ? { width: "auto", opacity: 1, marginInlineStart: 6 }
                    : { width: 0, opacity: 0, marginInlineStart: 0 }
                }
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : {
                        width: PILL_SPRING,
                        marginInlineStart: PILL_SPRING,
                        // Le texte arrive un peu après la largeur et part avant
                        // elle : il n'apparaît jamais coupé par le bord.
                        opacity: {
                          duration: active ? 0.25 : 0.12,
                          delay: active ? 0.08 : 0,
                        },
                      }
                }
              >
                {label}
              </motion.span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
