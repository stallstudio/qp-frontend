import { OpeningHour } from "@/types/openingHour";
import {
  CalendarClock,
  CalendarX2,
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

const typeIconMap: Record<OpeningHour["type"], LucideIcon> = {
  standard: CalendarClock,
  early_access: Sunrise,
  extension: Maximize2,
  private_event: Lock,
};

const typeOrder: Record<OpeningHour["type"], number> = {
  standard: 0,
  early_access: 1,
  extension: 2,
  private_event: 3,
};

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

  const typeLabelMap: Record<OpeningHour["type"], string> = {
    standard: t("todayHours"),
    early_access: t("extraOpeningHours"),
    extension: t("extendedHours"),
    private_event: t("privateEvent"),
  };

  const sortedOpeningHours = [...openingHours].sort(
    (a, b) => typeOrder[a.type] - typeOrder[b.type],
  );

  // Check if there's a private event without hours
  const hasPrivateEventNoHours = sortedOpeningHours.some(
    (hour) => hour.type === "private_event" && !hour.openTime && !hour.closeTime
  );

  // Check if all opening hours have null openTime and closeTime
  const allTimesNull =
    sortedOpeningHours.length > 0 &&
    sortedOpeningHours.every((hour) => !hour.openTime && !hour.closeTime);

  return (
    <div>
      {hasPrivateEventNoHours ? (
        <div className="flex items-center gap-2 text-white">
          <Lock className="w-4 h-4" />
          <p>{t("privateEventNoHours")}</p>
        </div>
      ) : allTimesNull ? (
        <div className="flex items-center gap-2 text-white">
          <CalendarX2 className="w-4 h-4" />
          <p>{t("closedToday")}</p>
        </div>
      ) : sortedOpeningHours.length > 0 ? (
        sortedOpeningHours
          .filter((hour) => hour.openTime && hour.closeTime)
          .map((openingHour, index) => {
            const Icon = typeIconMap[openingHour.type];
            const label = typeLabelMap[openingHour.type];

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
