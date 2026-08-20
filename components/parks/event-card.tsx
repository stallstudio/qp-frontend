"use client";

import { Card } from "@/components/ui/card";
import { cn, getLuxonFormat } from "@/lib/utils";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import type { ParkEventView } from "@/lib/park-events";
import { ChevronDown, Ghost, Gift, Sparkles } from "lucide-react";
import { DateTime } from "luxon";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

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
};

/**
 * Icône de la FAMILLE d'événement, pas de l'événement.
 *
 * ⚠️ Une icône par famille et non par événement — même raisonnement que pour la
 * teinte : les sources publient bien une couleur et un visuel par opération,
 * mais les empiler produirait un patchwork au lieu d'une famille lisible. Une
 * famille inconnue retombe sur une icône neutre plutôt que de faire planter le
 * rendu, piège déjà rencontré sur `typeIconMap` des horaires.
 */
const ACCENT_ICONS: Record<string, typeof Ghost> = {
  halloween: Ghost,
  christmas: Gift,
};

// Teintes de famille. Volontairement DÉSATURÉES et distinctes du corail de
// marque (`--primary`) comme de l'ambre des favoris : la carte doit se
// distinguer sans concurrencer l'identité du site ni les repères existants.
const ACCENT_CLASSES: Record<string, string> = {
  halloween:
    "border-orange-300/60 bg-orange-50/70 dark:border-orange-900/50 dark:bg-orange-950/20",
  christmas:
    "border-emerald-300/60 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20",
};

const ACCENT_TEXT: Record<string, string> = {
  halloween: "text-orange-700 dark:text-orange-300",
  christmas: "text-emerald-700 dark:text-emerald-300",
};

export default function EventCard({
  view,
  timezone,
  children,
  isEmpty = false,
  emptyLabel,
}: EventCardProps) {
  const t = useTranslations("events");
  const { is12Hour } = useTimeFormat();
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

  const Icon = ACCENT_ICONS[event.accent ?? ""] ?? Sparkles;
  const accentClass = ACCENT_CLASSES[event.accent ?? ""] ?? "";
  const accentText = ACCENT_TEXT[event.accent ?? ""] ?? "text-muted-foreground";

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
        <Icon className={cn("size-5 shrink-0", accentText)} />
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

      {open && (
        <div className="border-t pb-2">
          {isEmpty ? (
            // Un événement confirmé dont rien ne remonte encore : ça arrive
            // avant l'ouverture des portes. On le dit, plutôt que de laisser un
            // encadré vide.
            <p className="py-4 text-center text-sm text-muted-foreground">
              {emptyLabel ?? t("noAttractions")}
            </p>
          ) : (
            children
          )}
        </div>
      )}
    </Card>
  );
}
