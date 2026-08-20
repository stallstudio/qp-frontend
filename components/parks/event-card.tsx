"use client";

import { Card } from "@/components/ui/card";
import { cn, getLuxonFormat } from "@/lib/utils";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import type { ParkEventView } from "@/lib/park-events";
import { ChevronDown } from "lucide-react";
import { accentStyle } from "./event-accents";
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

  const { icon: Icon, card: accentClass, iconClass, decor } = accentStyle(
    event.accent,
  );

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
        // `relative` + `overflow-hidden` : le décor est posé en absolu et doit
        // être découpé par les coins arrondis, sinon les dégradés débordent aux
        // quatre angles.
        "relative w-full gap-0 overflow-hidden rounded-4xl border p-2.5 py-0 sm:p-4 sm:py-0",
        accentClass,
      )}
    >
      {/* Décor de famille (braise, givre). SOUS le contenu et sans interaction :
          il ne doit ni intercepter un clic, ni être annoncé par un lecteur
          d'écran. */}
      {decor}
      {/* En-tête cliquable. UN SEUL CONTENANT qui s'ouvre : replié on ne voit
          que cette ligne, déplié le contenu apparaît dessous, dans le
          même encadré. Une seule chose à comprendre, et seul le chevron change
          entre les deux états. */}
      <button
        type="button"
        onClick={() => setManual(!open)}
        aria-expanded={open}
        // `relative z-10` : au-dessus du décor, qui est en absolu derrière.
        className="relative z-10 flex w-full items-center gap-2.5 py-3 text-left"
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

      {open && (
        // ⚠️ Fond opaque une fois DÉPLIÉ : le décor traverse toute la carte, et
        // une table de temps d'attente lue par-dessus un dégradé animé est
        // pénible. L'effet reste donc cantonné à l'en-tête, qui est ce qu'on
        // voit onze mois par an.
        <div className="relative z-10 border-t bg-card/85 pb-2 backdrop-blur-[2px]">
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
