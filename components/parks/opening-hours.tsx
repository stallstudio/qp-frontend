import { OpeningHour } from "@/types/openingHour";
import {
  CalendarClock,
  CalendarX2,
  LucideIcon,
  Maximize2,
  Sunrise,
} from "lucide-react";
import { DateTime } from "luxon";
import { useTranslations } from "next-intl";

type ParkOpeningHoursProps = {
  openingHours: OpeningHour[];
  timezone: string;
};

const typeIconMap: Record<OpeningHour["type"], LucideIcon> = {
  standard: CalendarClock,
  early_access: Sunrise,
  extension: Maximize2,
};

const typeOrder: Record<OpeningHour["type"], number> = {
  standard: 0,
  early_access: 1,
  extension: 2,
};

const formatTime = (timeString: string, timezone: string): string => {
  return DateTime.fromISO(timeString, { zone: "utc" })
    .setZone(timezone)
    .toFormat("HH:mm");
};

export default function ParkOpeningHours({
  openingHours,
  timezone,
}: ParkOpeningHoursProps) {
  const t = useTranslations("parkPage");

  const typeLabelMap: Record<OpeningHour["type"], string> = {
    standard: t("todayHours"),
    early_access: t("extraOpeningHours"),
    extension: t("extendedHours"),
  };

  const sortedOpeningHours = [...openingHours].sort(
    (a, b) => typeOrder[a.type] - typeOrder[b.type],
  );

  // Check if all opening hours have null openTime and closeTime
  const allTimesNull =
    sortedOpeningHours.length > 0 &&
    sortedOpeningHours.every((hour) => !hour.openTime && !hour.closeTime);

  return (
    <div>
      {allTimesNull ? (
        <div className="flex items-center gap-2 text-white">
          <CalendarX2 className="w-4 h-4" />
          <p>{t("closedToday")}</p>
        </div>
      ) : sortedOpeningHours.length > 0 ? (
        sortedOpeningHours.map((openingHour, index) => {
          const Icon = typeIconMap[openingHour.type];
          const label = typeLabelMap[openingHour.type];

          return (
            <div key={index} className="flex items-center gap-2 text-white">
              <Icon className="w-4 h-4" />
              <p>
                <span className="font-medium">{label}</span>:{" "}
                {formatTime(openingHour.openTime!, timezone)} -{" "}
                {formatTime(openingHour.closeTime!, timezone)}
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
