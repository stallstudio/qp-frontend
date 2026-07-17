"use client";

import { useMemo } from "react";
import { DateTime } from "luxon";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import type { TimedPoint } from "@/types/rideHistory";

type WaitTimeChartProps = {
  today: TimedPoint[];
  forecast: TimedPoint[];
  window: { open: string; close: string } | null;
  now: string;
  timezone: string;
  nowLabel: string;
  todayLabel: string;
  forecastLabel: string;
};

type ChartRow = { t: number; actual: number | null; forecast: number | null };

// Graphique de l'évolution du jour + prévision, via Recharts (grille, points
// réguliers 15 min, tooltip au clic). Thématisé par le ChartContainer shadcn.
export default function WaitTimeChart({
  today,
  forecast,
  window: win,
  now,
  timezone,
  nowLabel,
  todayLabel,
  forecastLabel,
}: WaitTimeChartProps) {
  const { is12Hour } = useTimeFormat();

  const fmtTime = (ms: number) =>
    DateTime.fromMillis(ms)
      .setZone(timezone)
      .toFormat(is12Hour ? "h:mm a" : "HH:mm");

  const { data, xMin, xMax, yMax, nowMs } = useMemo(() => {
    const rows = new Map<number, ChartRow>();
    const row = (t: number) => {
      let entry = rows.get(t);
      if (!entry) {
        entry = { t, actual: null, forecast: null };
        rows.set(t, entry);
      }
      return entry;
    };

    for (const p of today) row(Date.parse(p.t)).actual = p.waitTime;
    for (const p of forecast) row(Date.parse(p.t)).forecast = p.waitTime;

    // Raccord : le dernier point observé amorce aussi la prévision (continuité
    // solide -> pointillé).
    const lastActual = [...today].reverse().find((p) => p.waitTime != null);
    if (lastActual) row(Date.parse(lastActual.t)).forecast = lastActual.waitTime;

    const data = [...rows.values()].sort((a, b) => a.t - b.t);

    const values = data
      .flatMap((d) => [d.actual, d.forecast])
      .filter((v): v is number => v != null);
    const rawMax = values.length ? Math.max(...values) : 0;
    const yMax = Math.max(10, Math.ceil(rawMax / 10) * 10);

    const times = data.map((d) => d.t);
    const nowMs = Date.parse(now);
    const xMin = win ? Date.parse(win.open) : Math.min(...times, nowMs);
    const xMax = win ? Date.parse(win.close) : Math.max(...times, nowMs);

    return { data, xMin, xMax, yMax, nowMs };
  }, [today, forecast, now, win]);

  const chartConfig = {
    actual: { label: todayLabel, color: "var(--primary)" },
    forecast: { label: forecastLabel, color: "var(--primary)" },
  } satisfies ChartConfig;

  const showNow = nowMs >= xMin && nowMs <= xMax;

  // Tooltip au clic : heure + temps par série, en filtrant les séries à valeur
  // nulle (recharts les inclut au point courant sinon -> « null min »).
  type TipEntry = {
    dataKey?: string | number;
    value?: number | null;
    color?: string;
    payload?: ChartRow;
  };
  function WaitTooltip({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: TipEntry[];
  }) {
    if (!active || !payload?.length) return null;
    const rows = payload.filter((p) => p.value != null);
    if (!rows.length) return null;
    const ms = rows[0].payload?.t;
    return (
      <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
        {ms != null && <div className="mb-1 font-medium">{fmtTime(ms)}</div>}
        <div className="grid gap-1">
          {rows.map((r) => (
            <div key={String(r.dataKey)} className="flex items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-[2px]"
                style={{ background: r.color }}
              />
              <span className="text-muted-foreground">
                {r.dataKey === "actual" ? todayLabel : forecastLabel}
              </span>
              <span className="ml-auto font-mono font-medium tabular-nums">
                {r.value} min
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[180px] w-full">
      <LineChart data={data} margin={{ top: 8, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid vertical horizontal strokeDasharray="3 3" />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={[xMin, xMax]}
          tickFormatter={fmtTime}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={40}
        />
        <YAxis
          domain={[0, yMax]}
          width={40}
          tickLine={false}
          axisLine={false}
          tickCount={4}
          allowDecimals={false}
        />
        {showNow && (
          <ReferenceLine
            x={nowMs}
            stroke="var(--primary)"
            strokeOpacity={0.4}
            strokeDasharray="2 3"
            label={{
              value: nowLabel,
              position: "insideTopRight",
              fontSize: 10,
              fill: "var(--primary)",
            }}
          />
        )}
        <ChartTooltip trigger="click" content={<WaitTooltip />} />
        <Line
          name={todayLabel}
          dataKey="actual"
          type="monotone"
          stroke="var(--color-actual)"
          strokeWidth={2}
          dot={{ r: 2 }}
          activeDot={{ r: 4 }}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          name={forecastLabel}
          dataKey="forecast"
          type="monotone"
          stroke="var(--color-forecast)"
          strokeOpacity={0.6}
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={{ r: 2 }}
          activeDot={{ r: 4 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
