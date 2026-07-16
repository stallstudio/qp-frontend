"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { DateTime } from "luxon";
import { CalendarRange, Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AffluenceCalendar from "./affluence-calendar";
import AffluenceDayDetail from "./affluence-day-detail";
import type { DayAffluence, ParkDayStats } from "@/types/affluence";

type MonthHours = Record<string, { open: string | null; close: string | null }>;

type Props = {
  parkIdentifier: string;
  parkName: string;
  timezone: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function AffluenceDialog({
  parkIdentifier,
  parkName,
  timezone,
}: Props) {
  const t = useTranslations("affluence");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const statsParam = searchParams.get("stats");
  const open = statsParam !== null;
  const selectedDate =
    statsParam && DATE_RE.test(statsParam) ? statsParam : null;

  const todayStr = useMemo(
    () => DateTime.now().setZone(timezone).toISODate() ?? "",
    [timezone],
  );

  // ── Data ──
  const [affluence, setAffluence] = useState<Record<string, DayAffluence> | null>(
    null,
  );
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [datesLoaded, setDatesLoaded] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const n = DateTime.now().setZone(timezone);
    return { y: n.year, m: n.month };
  });
  const [monthHours, setMonthHours] = useState<MonthHours>({});
  const [hoursLoading, setHoursLoading] = useState(false);
  const [dayStats, setDayStats] = useState<ParkDayStats | null>(null);
  const [dayLoading, setDayLoading] = useState(false);

  const monthHoursCache = useRef<Map<string, MonthHours>>(new Map());
  const dayCache = useRef<Map<string, ParkDayStats>>(new Map());
  const didInitMonth = useRef(false);

  // Navigable range. Lower bound = the first month this park actually has data
  // (so a park whose data starts in March 2026 can't go back to February). Upper
  // bound = January of next year (dynamic, relative to the park's "now"); months
  // in between with no data stay reachable — the floor is the only hard limit.
  const bounds = useMemo(() => {
    const nowYear = DateTime.now().setZone(timezone).year;
    let earliest = "";
    availableDates.forEach((d) => {
      if (!earliest || d < earliest) earliest = d;
    });
    const min = earliest
      ? { y: Number(earliest.slice(0, 4)), m: Number(earliest.slice(5, 7)) }
      : { y: 2026, m: 1 };
    return { min, max: { y: nowYear + 1, m: 1 } };
  }, [timezone, availableDates]);

  // ── URL helpers ──
  const setStatsParam = useCallback(
    (val: string | null) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (val === null) sp.delete("stats");
      else sp.set("stats", val);
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  // Fetch affluence + available dates once, when first opened.
  useEffect(() => {
    if (!open || affluence !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const [a, d] = await Promise.all([
          axios.get(`/api/park/${parkIdentifier}/stats/affluence`),
          axios.get(`/api/park/${parkIdentifier}/stats/available-dates`),
        ]);
        if (cancelled) return;
        setAffluence(a.data.days || {});
        setAvailableDates(new Set<string>(d.data.dates || []));
        setDatesLoaded(true);
      } catch {
        if (cancelled) return;
        setAffluence({});
        setDatesLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, affluence, parkIdentifier]);

  // On first open without a deep-linked date, land on the latest month with data.
  useEffect(() => {
    if (!open || didInitMonth.current) return;
    if (selectedDate) {
      didInitMonth.current = true;
      return;
    }
    if (datesLoaded) {
      let latest = "";
      availableDates.forEach((x) => {
        if (x > latest) latest = x;
      });
      if (latest) {
        const dt = DateTime.fromISO(latest);
        setViewMonth({ y: dt.year, m: dt.month });
      }
      didInitMonth.current = true;
    }
  }, [open, selectedDate, datesLoaded, availableDates]);

  // Keep the calendar month in sync with a deep-linked / selected date.
  useEffect(() => {
    if (!selectedDate) return;
    const dt = DateTime.fromISO(selectedDate);
    setViewMonth((v) =>
      v.y === dt.year && v.m === dt.month ? v : { y: dt.year, m: dt.month },
    );
  }, [selectedDate]);

  // Fetch the visible month's opening hours (cached per month).
  useEffect(() => {
    if (!open) return;
    const key = `${viewMonth.y}-${viewMonth.m}`;
    const cached = monthHoursCache.current.get(key);
    if (cached) {
      setMonthHours(cached);
      return;
    }
    let cancelled = false;
    setHoursLoading(true);
    axios
      .get(
        `/api/park/${parkIdentifier}/stats/opening-hours?year=${viewMonth.y}&month=${viewMonth.m}`,
      )
      .then((r) => {
        if (cancelled) return;
        const h: MonthHours = r.data.hours || {};
        monthHoursCache.current.set(key, h);
        setMonthHours(h);
      })
      .catch(() => {
        if (!cancelled) setMonthHours({});
      })
      .finally(() => {
        if (!cancelled) setHoursLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, viewMonth, parkIdentifier]);

  // Fetch the selected day's stats (cached per date).
  useEffect(() => {
    if (!open || !selectedDate) return;
    const cached = dayCache.current.get(selectedDate);
    if (cached) {
      setDayStats(cached);
      return;
    }
    let cancelled = false;
    setDayLoading(true);
    setDayStats(null);
    axios
      .get(`/api/park/${parkIdentifier}/stats?date=${selectedDate}`)
      .then((r) => {
        if (cancelled) return;
        dayCache.current.set(selectedDate, r.data);
        setDayStats(r.data);
      })
      .catch(() => {
        if (!cancelled) setDayStats(null);
      })
      .finally(() => {
        if (!cancelled) setDayLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, selectedDate, parkIdentifier]);

  const clampMonth = useCallback(
    (y: number, m: number) => {
      const idx = (yy: number, mm: number) => yy * 12 + (mm - 1);
      const lo = idx(bounds.min.y, bounds.min.m);
      const hi = idx(bounds.max.y, bounds.max.m);
      const k = Math.min(hi, Math.max(lo, idx(y, m)));
      return { y: Math.floor(k / 12), m: (k % 12) + 1 };
    },
    [bounds],
  );

  const navigate = (delta: number) =>
    setViewMonth((v) => {
      let m = v.m + delta;
      let y = v.y;
      if (m < 1) {
        m = 12;
        y--;
      }
      if (m > 12) {
        m = 1;
        y++;
      }
      return clampMonth(y, m);
    });

  const setMonth = (y: number, m: number) => setViewMonth(clampMonth(y, m));

  const handleShare = useCallback(async () => {
    if (!selectedDate) return;
    const url = `${window.location.origin}${pathname}?stats=${selectedDate}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: parkName, url });
        return;
      } catch {
        // user dismissed — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("linkCopied"));
    } catch {
      toast.error(t("linkCopyError"));
    }
  }, [selectedDate, pathname, parkName, t]);

  return (
    <>
      <Button
        variant="outline"
        className="w-fit rounded-full"
        onClick={() => setStatsParam("open")}
      >
        <CalendarRange />
        {t("trigger")}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) setStatsParam(null);
        }}
      >
        <DialogContent
          className={`w-full max-h-[90dvh] flex flex-col gap-0 p-0 overflow-hidden rounded-4xl ${
            selectedDate ? "sm:max-w-2xl" : "sm:max-w-3xl lg:max-w-5xl"
          }`}
        >
          <DialogHeader className="px-4 py-3 sm:px-5 sm:py-3.5 border-b text-left space-y-0.5">
            <DialogTitle className="text-base sm:text-lg">
              {t("title")}
            </DialogTitle>
            <DialogDescription>
              {parkName} · {t("subtitle")}
            </DialogDescription>
          </DialogHeader>

          <div className="px-4 py-4 sm:px-5 flex-1 min-h-0 overflow-y-auto">
            {affluence === null ? (
              <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
                <span className="text-sm">{t("loading")}</span>
              </div>
            ) : selectedDate ? (
              dayStats ? (
                <AffluenceDayDetail
                  stats={dayStats}
                  aff={affluence[selectedDate]}
                  timezone={timezone}
                  dateStr={selectedDate}
                  loading={dayLoading}
                  onBack={() => setStatsParam("open")}
                  onShare={handleShare}
                />
              ) : (
                <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" />
                  <span className="text-sm">{t("loading")}</span>
                </div>
              )
            ) : (
              <AffluenceCalendar
                year={viewMonth.y}
                month={viewMonth.m}
                affluence={affluence}
                availableDates={availableDates}
                monthHours={monthHours}
                todayStr={todayStr}
                timezone={timezone}
                loading={hoursLoading || !datesLoaded}
                minMonth={bounds.min}
                maxMonth={bounds.max}
                onSelectDate={(date) => setStatsParam(date)}
                onNavigate={navigate}
                onSetMonth={setMonth}
                onToday={() => setStatsParam(todayStr)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
