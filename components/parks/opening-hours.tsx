import { OpeningHour } from "@/types/openingHour";
import {
  CalendarClock,
  CalendarX2,
  Ghost,
  Lock,
  LucideIcon,
  Maximize2,
  Sunrise,
} from "lucide-react";
import { DateTime } from "luxon";
import { useTranslations } from "next-intl";
import { getLuxonFormat } from "@/lib/utils";
import { useTimeFormat } from "@/hooks/useTimeFormat";

type ParkOpeningHoursProps = {
  openingHours: OpeningHour[];
  timezone: string;
};

// ⚠️ **`Record<string, …>` et un REPLI, pas un `Record` exhaustif.**
//
// Ces tables étaient indexées par un `type` de type `string` (ouvert) tout en
// prétendant couvrir toutes les valeurs. Un type absent donnait donc
// `Icon === undefined`, et rendre `<undefined />` FAIT PLANTER React — pas un
// libellé manquant, un écran blanc. Le bug ne demandait qu'un sixième type pour
// se déclencher ; `event` est ce sixième type.
const typeIconMap: Record<string, LucideIcon> = {
  standard: CalendarClock,
  early_access: Sunrise,
  extension: Maximize2,
  private_event: Lock,
  sold_out: CalendarClock,
  event: Ghost,
};

const FALLBACK_ICON = CalendarClock;

const typeOrder: Record<string, number> = {
  standard: 0,
  early_access: 1,
  extension: 2,
  // La session d'événement se lit APRÈS la journée du parc : c'est ce qui se
  // passe ensuite, dans l'ordre de la journée.
  event: 3,
  private_event: 4,
  sold_out: 5,
};

const FALLBACK_ORDER = 99;

const formatTime = (
  timeString: string,
  timezone: string,
  is12Hour: boolean,
): string => {
  const format = getLuxonFormat(is12Hour);
  return DateTime.fromISO(timeString, { zone: "utc" })
    .setZone(timezone)
    .toFormat(format);
};

export default function ParkOpeningHours({
  openingHours,
  timezone,
}: ParkOpeningHoursProps) {
  const t = useTranslations("parkPage");
  const { is12Hour } = useTimeFormat();

  const typeLabelMap: Record<string, string> = {
    standard: t("todayHours"),
    early_access: t("extraOpeningHours"),
    extension: t("extendedHours"),
    private_event: t("privateEvent"),
    sold_out: t("hoursUnavailable"),
    event: t("eventHours"),
  };

  const sortedOpeningHours = [...openingHours].sort(
    (a, b) =>
      (typeOrder[a.type] ?? FALLBACK_ORDER) -
      (typeOrder[b.type] ?? FALLBACK_ORDER),
  );

  // Check if there's a private event without hours
  const hasPrivateEventNoHours = sortedOpeningHours.some(
    (hour) => hour.type === "private_event" && !hour.openTime && !hour.closeTime,
  );

  // Check if there's a sold-out day (park is open but tickets are sold out)
  const hasSoldOut = sortedOpeningHours.some((hour) => hour.type === "sold_out");

  // ————————————————————————————————————————————————————————————————
  // C'EST LA LIGNE `standard` QUI DIT SI LE PARC EST FERMÉ
  //
  // ⚠️ Le test était `every` : TOUTES les lignes devaient être vides. Une seule
  // ligne encore horodatée suffisait donc à faire disparaître « Fermé
  // aujourd'hui » — et comme le `.filter()` plus bas écarte les lignes sans
  // horaires, la ligne `standard` vide s'évaporait sans rien afficher. La page
  // ne montrait plus qu'« Horaires anticipés : 9 h 30 – 10 h » d'un parc fermé.
  //
  // Constaté le 2026-09-03 sur Parc Astérix, qui a fermé en cours de journée en
  // laissant derrière lui l'`early_access` écrite pendant la nuit. Le fetcher
  // annule désormais cette ligne à la source ; ce test est le filet pour les
  // sources qu'on n'a pas auditées, et pour le jour où la ligne traîne avant
  // que le worker ne repasse.
  //
  // `standard` est la ligne qui décrit la journée d'exploitation : vide, elle
  // dit que le parc ne fait pas sa journée — à ceci près qu'une SESSION
  // autonome peut quand même avoir lieu ce soir-là (voir juste en dessous).
  // Sans ligne `standard` du tout, on retombe sur l'ancien test.
  // ————————————————————————————————————————————————————————————————
  const standardHours = sortedOpeningHours.find(
    (hour) => hour.type === "standard",
  );

  // ⚠️ **`early_access` est le SEUL type qu'on ignore ici, et la liste ne doit
  // pas s'allonger.** Il n'existe que comme préambule à la journée standard :
  // sans journée, il ne veut rien dire, et c'est précisément la ligne qui reste
  // en arrière quand un parc ferme après coup.
  //
  // Les autres types sont des SESSIONS À PART ENTIÈRE, qui se tiennent debout
  // sans journée de jour : la nocturne d'Halloween à billet séparé, la
  // privatisation. Les ignorer ferait dire « Fermé aujourd'hui » à une page qui
  // annonce une soirée — deux motifs déjà en base : Plopsaland le 2026-04-04
  // (journée vide + `private_event` 10 h – 18 h) et les 64 nuits de Halloween
  // Horror Nights d'Universal Studios Florida, qui n'ont aujourd'hui aucune
  // ligne `standard` mais en auront une le jour où la source décrira la journée
  // fermée.
  const hasOtherSessionWithHours = sortedOpeningHours.some(
    (hour) =>
      hour.type !== "standard" &&
      hour.type !== "early_access" &&
      hour.openTime &&
      hour.closeTime,
  );

  const isClosedToday = standardHours
    ? !standardHours.openTime &&
      !standardHours.closeTime &&
      !hasOtherSessionWithHours
    : sortedOpeningHours.length > 0 &&
      sortedOpeningHours.every((hour) => !hour.openTime && !hour.closeTime);

  return (
    <div>
      {hasPrivateEventNoHours ? (
        <div className="flex items-center gap-2 text-white">
          <Lock className="w-4 h-4" />
          <p>{t("privateEventNoHours")}</p>
        </div>
      ) : hasSoldOut && isClosedToday ? (
        <div className="flex items-center gap-2 text-white">
          <CalendarClock className="w-4 h-4" />
          <p>{t("hoursUnavailable")}</p>
        </div>
      ) : isClosedToday ? (
        <div className="flex items-center gap-2 text-white">
          <CalendarX2 className="w-4 h-4" />
          <p>{t("closedToday")}</p>
        </div>
      ) : sortedOpeningHours.length > 0 ? (
        sortedOpeningHours
          .filter((hour) => hour.openTime && hour.closeTime)
          .map((openingHour, index) => {
            const Icon = typeIconMap[openingHour.type] ?? FALLBACK_ICON;
            // ⚠️ `label` L'EMPORTE sur le libellé traduit du type. C'est ce qui
            // fait dire « Traumatica : 19:00 – 01:00 » plutôt que
            // « Horaires étendus » — le visiteur cherche le nom de l'événement,
            // pas la catégorie sous laquelle on l'a rangé. Non traduit, comme
            // les noms d'attractions : il vient de la source.
            const label =
              openingHour.label ||
              typeLabelMap[openingHour.type] ||
              t("hoursOther");

            return (
              <div key={index} className="flex items-center gap-2 text-white">
                <Icon className="w-4 h-4 shrink-0" />
                <p>
                  <span className="font-medium">{label}</span>:{" "}
                  {formatTime(openingHour.openTime!, timezone, is12Hour)} -{" "}
                  {formatTime(openingHour.closeTime!, timezone, is12Hour)}
                </p>
              </div>
            );
          })
      ) : (
        <div className="flex items-center gap-2 text-white">
          <CalendarClock className="w-4 h-4" />
          <p>{t("hoursUnavailable")}</p>
        </div>
      )}
    </div>
  );
}
