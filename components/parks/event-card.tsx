"use client";

import { Card } from "@/components/ui/card";
import { cn, getLuxonFormat } from "@/lib/utils";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import type { ParkEventView } from "@/lib/park-events";
import type { WaitTime } from "@/types/waitTime";
import ParkWaitTimeTable from "./wait-time-table";
import { ChevronDown, Ghost, Gift, Sparkles } from "lucide-react";
import { DateTime } from "luxon";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

type EventCardProps = {
  view: ParkEventView;
  waitTimes: WaitTime[];
  queueTypeLabels?: Record<string, string> | null;
  parkIdentifier: string;
  parkName: string;
  timezone: string;
  reopenAllowed?: boolean;
  initialRideId?: number | null;
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
  waitTimes,
  queueTypeLabels,
  parkIdentifier,
  parkName,
  timezone,
  reopenAllowed = true,
  initialRideId = null,
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
          que cette ligne, déplié les attractions apparaissent dessous, dans le
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
          {waitTimes.length > 0 ? (
            <ParkWaitTimeTable
              waitTimes={waitTimes}
              queueTypeLabels={queueTypeLabels}
              parkIdentifier={parkIdentifier}
              parkName={parkName}
              reopenAllowed={reopenAllowed}
              initialRideId={initialRideId}
            />
          ) : (
            // Un événement confirmé dont aucune attraction ne publie encore de
            // temps d'attente : ça arrive avant l'ouverture des portes. On le
            // dit, plutôt que de laisser un encadré vide.
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("noAttractions")}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
