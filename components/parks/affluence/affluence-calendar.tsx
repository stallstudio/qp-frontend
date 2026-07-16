"use client";

import { useMemo } from "react";
import { DateTime, Info } from "luxon";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { getLuxonFormat } from "@/lib/utils";
import { affluenceCss, AFFLUENCE_LEGEND_GRADIENT } from "@/lib/affluence-color";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DayAffluence } from "@/types/affluence";

type MonthHours = Record<string, { open: string | null; close: string | null }>;
type YearMonth = { y: number; m: number };

type Props = {
  year: number;
  month: number; // 1–12
  affluence: Record<string, DayAffluence>;
  availableDates: Set<string>;
  monthHours: MonthHours;
  todayStr: string;
  timezone: string;
  loading: boolean;
  minMonth: YearMonth;
  maxMonth: YearMonth;
  onSelectDate: (date: string) => void;
  onNavigate: (delta: number) => void;
  onSetMonth: (year: number, month: number) => void;
  onToday: () => void;
};

const HACHURE =
  "repeating-linear-gradient(135deg, color-mix(in oklab, var(--muted-foreground) 14%, transparent) 0 5px, transparent 5px 10px)";

const pad = (n: number) => String(n).padStart(2, "0");

export default function AffluenceCalendar({
  year,
  month,
  affluence,
  availableDates,
  monthHours,
  todayStr,
  timezone,
  loading,
  minMonth,
  maxMonth,
  onSelectDate,
  onNavigate,
  onSetMonth,
  onToday,
}: Props) {
  const t = useTranslations("affluence");
  const locale = useLocale();
  const { is12Hour } = useTimeFormat();

  const weekdays = useMemo(
    // Luxon weekdays are Monday-first, matching our grid.
    () => Info.weekdays("short", { locale }),
    [locale],
  );

  const monthNamesLong = useMemo(() => Info.months("long", { locale }), [locale]);
  const monthNamesShort = useMemo(
    () => Info.months("short", { locale }),
    [locale],
  );

  const monthName = useMemo(() => {
    const name = monthNamesLong[month - 1] ?? "";
    return name.charAt(0).toUpperCase() + name.slice(1);
  }, [monthNamesLong, month]);

  // Bounds helpers (a month is a single comparable index yyyy*12 + mm).
  const idx = (y: number, m: number) => y * 12 + (m - 1);
  const loIdx = idx(minMonth.y, minMonth.m);
  const hiIdx = idx(maxMonth.y, maxMonth.m);
  const inRange = (y: number, m: number) => {
    const k = idx(y, m);
    return k >= loIdx && k <= hiIdx;
  };
  const canPrev = idx(year, month) > loIdx;
  const canNext = idx(year, month) < hiIdx;

  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = minMonth.y; y <= maxMonth.y; y++) out.push(y);
    return out;
  }, [minMonth.y, maxMonth.y]);

  const cells = useMemo(() => {
    const first = DateTime.fromObject({ year, month, day: 1 });
    const offset = (first.weekday + 6) % 7; // Monday = 0
    const daysInMonth = first.daysInMonth ?? 30;
    const out: (number | null)[] = [];
    for (let i = 0; i < offset; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(d);
    // Always render 6 week-rows so the grid height is constant across months.
    // A fixed height keeps the modal from re-centering (which would shift the
    // month arrows under the cursor) when navigating between 5- and 6-week months.
    while (out.length < 42) out.push(null);
    return out;
  }, [year, month]);

  const fmtHour = (iso: string) =>
    DateTime.fromISO(iso, { zone: "utc" })
      .setZone(timezone)
      .toFormat(getLuxonFormat(is12Hour));

  const canGoToday = availableDates.has(todayStr);

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <button
          type="button"
          onClick={() => onNavigate(-1)}
          disabled={!canPrev}
          aria-label={t("prevMonth")}
          className="grid place-items-center size-8 rounded-lg border hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <ChevronLeft className="size-4" />
        </button>

        <div className="flex items-center gap-1">
          {/* Month picker */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 rounded-lg px-2 py-1 font-semibold hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {monthName}
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-44">
              <div className="grid grid-cols-3 gap-0.5">
                {monthNamesShort.map((name, i) => {
                  const mm = i + 1;
                  const disabled = !inRange(year, mm);
                  return (
                    <DropdownMenuItem
                      key={mm}
                      disabled={disabled}
                      onSelect={() => onSetMonth(year, mm)}
                      className={`justify-center capitalize ${
                        mm === month ? "bg-accent font-semibold" : ""
                      }`}
                    >
                      {name}
                    </DropdownMenuItem>
                  );
                })}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Year picker */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 rounded-lg px-2 py-1 font-semibold tabular-nums hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {year}
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="min-w-[6rem]">
              {years.map((y) => (
                <DropdownMenuItem
                  key={y}
                  onSelect={() => onSetMonth(y, month)}
                  className={`justify-center tabular-nums ${
                    y === year ? "bg-accent font-semibold" : ""
                  }`}
                >
                  {y}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Loader2
            className={`size-3.5 text-muted-foreground ${loading ? "animate-spin" : "invisible"}`}
          />
        </div>

        <button
          type="button"
          onClick={() => onNavigate(1)}
          disabled={!canNext}
          aria-label={t("nextMonth")}
          className="grid place-items-center size-8 rounded-lg border hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1">
        {weekdays.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] sm:text-[11px] font-semibold text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 lg:gap-2">
        {cells.map((day, i) => {
          if (day === null)
            return (
              <div
                key={`e-${i}`}
                className="min-h-[50px] sm:min-h-[78px] lg:min-h-[88px]"
              />
            );

          const dateStr = `${year}-${pad(month)}-${pad(day)}`;
          const isToday = dateStr === todayStr;
          const isFuture = dateStr > todayStr;
          const hours = monthHours[dateStr];
          const isOpen = !!(hours?.open && hours?.close);
          const usable = availableDates.has(dateStr);
          const aff = usable ? affluence[dateStr] : undefined;
          const pct = aff ? Math.round(aff.rank * 100) : null;

          // Nothing to show → closed (past) or upcoming (future). A day counts as
          // "open" as soon as it has standard hours, even without wait-time data.
          if (!usable && !isOpen) {
            return (
              <div
                key={day}
                style={{ backgroundImage: HACHURE }}
                className={`relative flex flex-col rounded-lg border min-h-[50px] sm:min-h-[78px] lg:min-h-[88px] p-1.5 sm:p-2 lg:p-2.5 ${
                  isFuture ? "opacity-50" : ""
                } ${isToday ? "ring-2 ring-primary ring-inset" : ""}`}
              >
                <span className="text-[11px] sm:text-sm lg:text-base font-semibold tabular-nums leading-none text-muted-foreground">
                  {day}
                </span>
                <span className="hidden sm:block mt-auto text-[10px] lg:text-[11px] text-muted-foreground/80">
                  {isFuture ? t("upcoming") : t("closed")}
                </span>
              </div>
            );
          }

          const color =
            pct !== null && aff
              ? affluenceCss(aff.rank)
              : "var(--muted-foreground)";

          const cellBody = (
            <>
              {/* Header row: day number + colour dot in the corner */}
              <div className="flex items-start justify-between gap-1">
                <span className="text-[11px] sm:text-sm lg:text-base font-semibold tabular-nums leading-none">
                  {day}
                </span>
                {pct !== null && (
                  <span
                    aria-hidden="true"
                    className="size-2 sm:size-2.5 rounded-full shrink-0 mt-0.5"
                    style={{ background: color }}
                  />
                )}
              </div>

              {/* Percentage under the date (mobile + desktop) */}
              {pct !== null && (
                <span className="mt-0.5 sm:mt-1 text-[15px] sm:text-lg lg:text-xl font-bold tabular-nums leading-none">
                  {pct}
                  <span className="text-[9px] sm:text-[11px] font-semibold text-muted-foreground">
                    %
                  </span>
                </span>
              )}

              {/* Standard hours — shown for every open day, even without data. */}
              <span className="grow" />
              {isOpen && (
                <span className="hidden sm:flex items-center gap-1 text-[10.5px] lg:text-xs text-muted-foreground tabular-nums mb-1.5">
                  <Clock className="size-3 opacity-70 shrink-0" />
                  {fmtHour(hours!.open!)} – {fmtHour(hours!.close!)}
                </span>
              )}

              {/* Affluence gauge (length = %, colour = level) — only when scored. */}
              {pct !== null && (
                <>
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-1 sm:h-1.5 bg-muted"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute left-0 bottom-0 h-1 sm:h-1.5 rounded-r-full"
                    style={{ width: `${Math.max(6, pct)}%`, background: color }}
                  />
                </>
              )}
            </>
          );

          const cellClass = `relative flex flex-col rounded-lg border min-h-[50px] sm:min-h-[78px] lg:min-h-[88px] p-1.5 sm:p-2 lg:p-2.5 overflow-hidden ${
            isToday ? "ring-2 ring-primary ring-inset" : ""
          }`;

          // Open day but no wait-time data → recessive & not clickable: dashed,
          // transparent, muted text. Visually distinct from the solid, tappable
          // day cards (works on mobile too, where there is no hover cue).
          if (!usable) {
            return (
              <div
                key={day}
                className={`${cellClass} border-dashed bg-transparent text-muted-foreground`}
              >
                {cellBody}
              </div>
            );
          }

          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDate(dateStr)}
              className={`${cellClass} group text-left bg-card cursor-pointer hover:border-primary/40 hover:shadow-sm transition-[color,box-shadow,border-color]`}
            >
              {cellBody}
            </button>
          );
        })}
      </div>

      {/* Legend + Today */}
      <div className="flex items-center gap-3 mt-3 pt-2.5 border-t flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <span className="text-[11px] text-muted-foreground">
            {t("legendCalm")}
          </span>
          <span
            aria-hidden="true"
            className="h-2 flex-1 rounded-full"
            style={{ background: AFFLUENCE_LEGEND_GRADIENT }}
          />
          <span className="text-[11px] text-muted-foreground">
            {t("legendPacked")}
          </span>
        </div>
        <button
          type="button"
          onClick={onToday}
          disabled={!canGoToday}
          className="rounded-full border bg-secondary px-4 py-1.5 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent transition-colors"
        >
          {t("today")}
        </button>
      </div>
    </div>
  );
}
