"use client";

import { Card } from "@/components/ui/card";
import { cn, getLuxonFormat } from "@/lib/utils";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import type { ParkEventView } from "@/lib/park-events";
import { ChevronDown } from "lucide-react";
import { accentStyle } from "./event-accents";
import { DateTime } from "luxon";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

// Courbe « iOS » : départ franc, arrivée très amortie. La même que la pastille
// des onglets (`main-card`) — toute la page doit bouger de la même façon.
const EASE_IOS: [number, number, number, number] = [0.32, 0.72, 0, 1];

// Deux temps, et dans cet ORDRE : la carte s'ouvre d'abord, le contenu ne se
// révèle qu'ensuite. Faire les deux ensemble donnait des lignes déjà lisibles
// dans une carte encore en train de grandir — l'œil ne savait plus quoi suivre.
// Au repli, l'inverse : le contenu s'efface, puis la carte se referme sur du
// vide. Le décalage est court (0,10 s) : c'est un enchaînement, pas une queue.
const HEIGHT_IN = { duration: 0.34, ease: EASE_IOS };
const HEIGHT_OUT = { duration: 0.28, ease: EASE_IOS };
const CONTENT_IN = { duration: 0.22, ease: "easeOut" as const, delay: 0.1 };
const CONTENT_OUT = { duration: 0.12, ease: "easeIn" as const };

type EventCardProps = {
  view: ParkEventView;
  timezone: string;
  /**
   * Le contenu : la table des temps d'attente de l'événement, ou sa grille de
   * spectacles.
   *
   * ⚠️ **La carte ignore ce qu'elle contient, et c'est le but.** Elle porte
   * l'en-tête, l'état replié/déplié et la teinte de famille ; ce qu'on y range
   * regarde l'appelant. Sans ça, ajouter les spectacles aurait demandé une
   * seconde carte quasi identique — deux comportements de repli à garder
   * d'accord, pour un seul motif visuel.
   */
  children: React.ReactNode;
  /** Rien à montrer : on le dit, au lieu d'un encadré vide. */
  isEmpty?: boolean;
  emptyLabel?: string;
  /**
   * Arrondis de la carte, imposés par la COLONNE qui l'empile (`main-card`) :
   * une carte prise entre deux autres n'a pas les mêmes angles qu'une carte
   * isolée. Elle ignore donc sa propre place dans la pile — c'est son appelant
   * qui la lui donne.
   */
  className?: string;
};

export default function EventCard({
  view,
  timezone,
  children,
  isEmpty = false,
  emptyLabel,
  className,
}: EventCardProps) {
  const t = useTranslations("events");
  const { is12Hour } = useTimeFormat();
  // Animations désactivées si le système le demande : le repli/dépli reste
  // instantané, comme le fait déjà la bascule de thème (`theme-transition`).
  //
  // ⚠️ Les transitions sont portées par les VARIANTES (`animate`/`exit`), pas
  // par la prop `transition` : au repli, `AnimatePresence` rejoue l'élément
  // sorti avec ses ANCIENNES props — un choix fait ici à partir de `open`
  // lirait donc `true` et refermerait la carte avec la courbe d'ouverture.
  const reduceMotion = useReducedMotion();
  const still = { duration: 0 };
  const heightIn = reduceMotion ? still : HEIGHT_IN;
  const heightOut = reduceMotion ? still : HEIGHT_OUT;
  const contentIn = reduceMotion ? still : CONTENT_IN;
  const contentOut = reduceMotion ? still : CONTENT_OUT;
  const { event, state, boundary } = view;

  // Déplié pendant l'événement, replié en dehors — mais l'état reste PILOTABLE :
  // une fois qu'on a cliqué, l'horloge ne referme plus la carte sous les doigts.
  const [manual, setManual] = useState<boolean | null>(null);
  const open = manual ?? state === "running";

  // Le calcul de `state` dépend de l'heure courante : il n'a lieu qu'après
  // montage côté appelant. On synchronise donc l'ouverture par défaut lorsque
  // l'état bascule, tant que l'utilisateur n'a rien décidé lui-même.
  useEffect(() => {
    setManual(null);
  }, [state]);

  const { icon: Icon, card: accentClass, iconClass } = accentStyle(event.accent);

  // ⚠️ **Le sous-titre ne porte QU'UNE heure : celle qui compte à cet instant.**
  // La plage complète (« 19:00 – 23:30 ») est déjà affichée dans l'en-tête du
  // parc ; la répéter ici serait un doublon. Et le nombre d'attractions n'y
  // figure pas : il se compte à l'écran une fois déplié, et ne sert à rien
  // replié.
  const boundaryLabel = boundary
    ? DateTime.fromJSDate(boundary)
        .setZone(timezone)
        .toFormat(getLuxonFormat(is12Hour))
    : null;

  const subtitle = boundaryLabel
    ? state === "running"
      ? t("closesAt", { time: boundaryLabel })
      : t("opensAt", { time: boundaryLabel })
    : state === "running"
      ? t("running")
      : t("scheduled");

  return (
    <Card
      className={cn(
        "w-full gap-0 rounded-4xl border p-2.5 py-0 sm:p-4 sm:py-0",
        accentClass,
        className,
      )}
    >
      {/* En-tête cliquable. UN SEUL CONTENANT qui s'ouvre : replié on ne voit
          que cette ligne, déplié le contenu apparaît dessous, dans le
          même encadré. Une seule chose à comprendre, et seul le chevron change
          entre les deux états. */}
      <button
        type="button"
        onClick={() => setManual(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 py-3 text-left"
      >
        <Icon className={cn("size-5 shrink-0", iconClass)} />
        <span className="min-w-0 flex-1">
          {/* Non traduit : le nom vient de la source, comme un nom d'attraction. */}
          <span className="block truncate font-semibold">{event.name}</span>
          <span className="block truncate text-sm text-muted-foreground">
            {subtitle}
            {event.separateTicket && (
              <>
                {" · "}
                {t("separateTicket")}
              </>
            )}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-5 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {/* `initial={false}` : une carte rendue DÉJÀ ouverte (événement en cours
          au chargement de la page) ne doit pas se déplier toute seule sous les
          yeux — l'animation ne concerne que les changements d'état. */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0 }}
            animate={{ height: "auto", transition: heightIn }}
            exit={{ height: 0, transition: heightOut }}
            // ⚠️ `overflow-hidden` : c'est lui qui fait le rideau. Sans, les
            // lignes débordent hors de la carte pendant toute l'ouverture.
            className="overflow-hidden"
          >
            {/* Le trait de séparation vit ICI, sur le bloc qui s'estompe, et
                non sur le rideau : posé dessus, il resterait affiché en carte
                fermée — 1 px de trait flottant sous l'en-tête. Il apparaît donc
                avec les lignes, en douceur. */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: contentIn }}
              exit={{ opacity: 0, transition: contentOut }}
              className="border-t pb-2"
            >
              {isEmpty ? (
                // Un événement confirmé dont rien ne remonte encore : ça arrive
                // avant l'ouverture des portes. On le dit, plutôt que de laisser
                // un encadré vide.
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {emptyLabel ?? t("noAttractions")}
                </p>
              ) : (
                children
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
