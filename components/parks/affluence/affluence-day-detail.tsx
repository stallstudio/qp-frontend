"use client";

import { useMemo } from "react";
import { DateTime } from "luxon";
import {
  ChevronLeft,
  Share2,
  Clock,
  Sunrise,
  Maximize2,
  Lock,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { getLuxonFormat } from "@/lib/utils";
import {
  affluenceCss,
  affluenceLevel,
  waitTimeColor,
} from "@/lib/affluence-color";
import type { DayAffluence, ParkDayStats } from "@/types/affluence";

type Props = {
  stats: ParkDayStats;
  aff?: DayAffluence;
  timezone: string;
  dateStr: string;
  loading: boolean;
  onBack: () => void;
  onShare: () => void;
};

const typeIcon: Record<string, LucideIcon> = {
  standard: CalendarClock,
  early_access: Sunrise,
  extension: Maximize2,
  private_event: Lock,
  sold_out: CalendarClock,
};

export default function AffluenceDayDetail({
  stats,
  aff,
  timezone,
  dateStr,
  loading,
  onBack,
  onShare,
}: Props) {
  const t = useTranslations("affluence");
  const tPark = useTranslations("parkPage");
  const locale = useLocale();
  const { is12Hour } = useTimeFormat();

  const typeLabel: Record<string, string> = {
    standard: tPark("todayHours"),
    early_access: tPark("extraOpeningHours"),
    extension: tPark("extendedHours"),
    private_event: tPark("privateEvent"),
    sold_out: tPark("hoursUnavailable"),
  };

  const dateTitle = useMemo(() => {
    const label = DateTime.fromISO(dateStr)
      .setLocale(locale)
      .toFormat("cccc d LLLL yyyy");
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [dateStr, locale]);

  const fmtHour = (iso: string) =>
    DateTime.fromISO(iso, { zone: "utc" })
      .setZone(timezone)
      .toFormat(getLuxonFormat(is12Hour));

  const pct = aff ? Math.round(aff.rank * 100) : null;
  const levelLabel = aff ? t(`levels.${affluenceLevel(aff.rank)}`) : null;

  const typedHours = stats.openingHours.filter((h) => h.openTime && h.closeTime);
  const maxProfile = Math.max(
    1,
    ...stats.dayProfile.map((p) => p.avgWait ?? 0),
  );
  const maxRideAvg = Math.max(1, ...stats.rides.map((r) => r.averageWait));

  const profileHours = stats.dayProfile.filter((p) => p.avgWait !== null);
  const axisHours =
    profileHours.length > 0
      ? [
          profileHours[0].hour,
          profileHours[Math.floor(profileHours.length / 2)].hour,
          profileHours[profileHours.length - 1].hour,
        ]
      : [];

  const hasContent = stats.rides.length > 0;

  return (
    <div className="flex flex-col min-h-0">
      {/* Controls */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-4" />
          {t("back")}
        </button>
        <button
          type="button"
          onClick={onShare}
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold hover:bg-accent transition-colors"
        >
          <Share2 className="size-3.5" />
          {t("share")}
        </button>
      </div>

      <h3 className="text-lg font-bold tracking-tight">{dateTitle}</h3>

      {!hasContent && !loading ? (
        <div className="flex flex-col items-center justify-center text-center gap-2 py-10 text-muted-foreground">
          <CalendarClock className="size-8 opacity-30" />
          <p className="text-sm">{t("noStatsForDay")}</p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-5 overflow-y-auto pr-1">
          {/* Frequentation + hours */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border bg-secondary/40 p-3.5">
              <div className="text-xs text-muted-foreground font-medium">
                {t("crowdLevel")}
              </div>
              {pct !== null ? (
                <>
                  <div className="mt-1 text-3xl font-bold tabular-nums leading-none">
                    {pct}
                    <span className="text-sm font-semibold text-muted-foreground">
                      %
                    </span>
                  </div>
                  <div className="mt-2 inline-flex items-center gap-2 text-sm font-semibold">
                    <span
                      className="size-3 rounded-full"
                      style={{ background: affluenceCss(aff!.rank) }}
                    />
                    {levelLabel}
                  </div>
                </>
              ) : (
                <div className="mt-2 text-sm text-muted-foreground">
                  {t("crowdUnavailable")}
                </div>
              )}
            </div>

            <div className="rounded-xl border bg-secondary/40 p-3.5">
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <Clock className="size-3.5" />
                {t("openingHours")}
              </div>
              {typedHours.length > 0 ? (
                <div className="mt-2 flex flex-col gap-1.5">
                  {typedHours.map((h, i) => {
                    const Icon = typeIcon[h.type] ?? CalendarClock;
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Icon className="size-3.5 text-muted-foreground shrink-0" />
                        {typedHours.length > 1 && (
                          <span className="text-muted-foreground">
                            {typeLabel[h.type] ?? h.type}
                          </span>
                        )}
                        <span
                          className={`font-semibold tabular-nums ${
                            typedHours.length > 1 ? "ml-auto" : ""
                          }`}
                        >
                          {fmtHour(h.openTime!)} – {fmtHour(h.closeTime!)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-2 text-sm text-muted-foreground">
                  {t("hoursUnavailable")}
                </div>
              )}
            </div>
          </div>

          {/* Day profile */}
          {profileHours.length > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-2">
                <span>{t("dayProfile")}</span>
                <span className="font-normal">{t("avgWait")}</span>
              </div>
              <div className="flex items-end gap-[3px] h-28">
                {stats.dayProfile.map((p, i) => (
                  <div
                    key={i}
                    title={
                      p.avgWait !== null
                        ? `${String(p.hour).padStart(2, "0")}h · ${p.avgWait} ${t("minutesShort")}`
                        : undefined
                    }
                    className="flex-1 rounded-t"
                    style={{
                      height:
                        p.avgWait !== null
                          ? `${Math.max(3, (p.avgWait / maxProfile) * 100)}%`
                          : "3px",
                      background:
                        p.avgWait !== null
                          ? waitTimeColor(p.avgWait, "open")
                          : "var(--muted)",
                    }}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-1.5 text-[10.5px] text-muted-foreground tabular-nums">
                {axisHours.map((h, i) => (
                  <span key={i}>{String(h).padStart(2, "0")}h</span>
                ))}
              </div>
              <div className="flex gap-3.5 mt-2.5 text-[11px] text-muted-foreground flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm" style={{ background: "#22c55e" }} />
                  {t("waitLow")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm" style={{ background: "#fb923c" }} />
                  {t("waitMid")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm" style={{ background: "#ef4444" }} />
                  {t("waitHigh")}
                </span>
              </div>
            </div>
          )}

          {/* Busiest attractions */}
          {stats.rides.length > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-2">
                <span>{t("busiestAttractions")}</span>
                <span className="font-normal">{t("avgOfDay")}</span>
              </div>
              <div className="flex flex-col">
                {stats.rides.map((ride) => {
                  const statusKey = ["closed", "down", "maintenance"].includes(
                    ride.status,
                  )
                    ? ride.status
                    : "closed";
                  return (
                    <div
                      key={ride.rideId}
                      className="flex items-center gap-3 py-2 border-t first:border-t-0 text-sm"
                    >
                      <span className="flex-1 min-w-0 truncate">
                        {ride.rideName}
                      </span>
                      {ride.operated ? (
                        <>
                          <span className="w-20 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: `${Math.min(100, (ride.averageWait / maxRideAvg) * 100)}%`,
                                background: waitTimeColor(ride.averageWait, "open"),
                              }}
                            />
                          </span>
                          <span className="w-14 text-right font-semibold tabular-nums shrink-0">
                            {ride.averageWait} {t("minutesShort")}
                          </span>
                        </>
                      ) : (
                        <span className="text-right text-xs font-medium text-muted-foreground shrink-0">
                          {t(`rideStatus.${statusKey}`)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {pct !== null ? t("crowdExplain", { pct }) : ""}
          </p>
        </div>
      )}
    </div>
  );
}
