"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
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
  // Libellé du temps observé DANS LE TOOLTIP (« Temps d'attente ») : distinct de
  // `todayLabel` (« Aujourd'hui ») qui, lui, ne sert qu'à la légende sous le
  // graphique pour opposer la courbe pleine du jour à la prévision en pointillé.
  actualLabel: string;
  forecastLabel: string;
};

type ChartRow = {
  t: number;
  actual: number | null;
  forecast: number | null;
  // Statut d'indispo (quand actual == null) : colore la barre basse + tooltip.
  status?: string | null;
  // Ancre invisible : vaut 0 sur les points d'indispo, null ailleurs. Sert
  // uniquement à garantir une entrée dans le payload du tooltip au survol d'une
  // plage d'indispo (recharts n'inclut pas les séries à valeur nulle).
  downMarker?: number | null;
};

// Plage temporelle (indispo pendant les heures d'ouverture) tracée en barre
// basse plutôt qu'en trou dans la courbe. `color` déduit du statut.
type DownBand = { x1: number; x2: number; color: string };

// Couleur de la barre d'indispo selon le statut : fermé/maintenance = rouge
// (rouge du badge « fermé »), en panne = orange (badge « en panne »), reste
// (indisponible/-1/inconnu) = gris (badge des valeurs indisponibles).
function downColor(status?: string | null): string {
  if (status === "down") return "#f97316"; // orange
  if (status === "closed" || status === "maintenance") return "#ef4444"; // rouge
  return "#9ca3af"; // gris
}

// Pas « propre » (multiple de 5) pour l'axe des temps : on vise ≤ 6 intervalles
// pour que les graduations restent lisibles et TOUJOURS multiples de 5
// (0/5/10/15/20/25…), jamais des valeurs brutes type 21/23/87.
function niceStep(max: number): number {
  const candidates = [5, 10, 15, 20, 25, 30, 50, 100, 150, 200, 300, 500];
  for (const s of candidates) if (max / s <= 6) return s;
  return Math.ceil(max / 6 / 5) * 5;
}

// Graphique de l'évolution du jour + prévision, via Recharts. Graduations Y
// multiples de 5, graduations X calées sur l'ouverture/fermeture + heures
// pleines, indispo tracée en barre basse (pas de trou), tooltip au survol.
export default function WaitTimeChart({
  today,
  forecast,
  window: win,
  now,
  timezone,
  nowLabel,
  todayLabel,
  actualLabel,
  forecastLabel,
}: WaitTimeChartProps) {
  const { is12Hour } = useTimeFormat();
  const tStatus = useTranslations("attractionStatus");

  const fmtTime = (ms: number) =>
    DateTime.fromMillis(ms)
      .setZone(timezone)
      .toFormat(is12Hour ? "h:mm a" : "HH:mm");

  const { data, xMin, xMax, yMax, yTicks, xTicks, nowMs, downBands } = useMemo(() => {
    const rows = new Map<number, ChartRow>();
    const row = (t: number) => {
      let entry = rows.get(t);
      if (!entry) {
        entry = { t, actual: null, forecast: null };
        rows.set(t, entry);
      }
      return entry;
    };

    for (const p of today) {
      const r = row(Date.parse(p.t));
      r.actual = p.waitTime;
      r.status = p.status;
    }
    for (const p of forecast) row(Date.parse(p.t)).forecast = p.waitTime;

    // Raccord : le dernier point observé amorce aussi la prévision (continuité
    // solide -> pointillé).
    const lastActual = [...today].reverse().find((p) => p.waitTime != null);
    if (lastActual) row(Date.parse(lastActual.t)).forecast = lastActual.waitTime;

    const data = [...rows.values()].sort((a, b) => a.t - b.t);

    const values = data
      .flatMap((d) => [d.actual, d.forecast])
      .filter((v): v is number => v != null);

    const nowMs = Date.parse(now);
    const times = data.map((d) => d.t);
    const xMin = win ? Date.parse(win.open) : Math.min(...times, nowMs);
    const xMax = win ? Date.parse(win.close) : Math.max(...times, nowMs);

    // Axe Y : borne haute arrondie au pas propre, graduations = multiples de 5.
    const rawMax = values.length ? Math.max(...values) : 0;
    const step = niceStep(Math.max(10, rawMax));
    const yMax = Math.max(step, Math.ceil(Math.max(10, rawMax) / step) * step);
    const yTicks: number[] = [];
    for (let v = 0; v <= yMax; v += step) yTicks.push(v);

    // Axe X : ouverture, fermeture, et toutes les heures pleines entre les deux.
    const xTicks: number[] = [xMin];
    let cur = DateTime.fromMillis(xMin).setZone(timezone).startOf("hour");
    if (cur.toMillis() <= xMin) cur = cur.plus({ hours: 1 });
    while (cur.toMillis() < xMax) {
      xTicks.push(cur.toMillis());
      cur = cur.plus({ hours: 1 });
    }
    xTicks.push(xMax);

    // Plages d'indispo observées (actual == null avant « maintenant ») : au lieu
    // d'un trou dans la courbe, une barre basse colorée par statut. On fusionne
    // les points consécutifs de MÊME couleur ; les bornes tombent au milieu des
    // points voisins (comble le trou sans chevaucher une plage de couleur
    // différente). Un i final « hors tableau » ferme la dernière plage.
    const todayPts = data.filter((d) => d.t <= nowMs);
    const downBands: DownBand[] = [];
    let runStart = -1;
    for (let i = 0; i <= todayPts.length; i++) {
      const p = todayPts[i];
      // i == length : sentinelle « hors tableau » qui ferme la dernière plage.
      const isDown = i < todayPts.length && p.actual == null;
      const color = isDown ? downColor(p.status) : "";
      const runColor = runStart !== -1 ? downColor(todayPts[runStart].status) : "";
      const continues = runStart !== -1 && isDown && color === runColor;
      if (runStart !== -1 && !continues) {
        const end = i - 1;
        const x1 =
          runStart > 0
            ? (todayPts[runStart - 1].t + todayPts[runStart].t) / 2
            : todayPts[runStart].t;
        const x2 =
          end < todayPts.length - 1
            ? (todayPts[end].t + todayPts[end + 1].t) / 2
            : todayPts[end].t;
        if (x2 > x1) downBands.push({ x1, x2, color: runColor });
        runStart = -1;
      }
      if (isDown && runStart === -1) runStart = i;
    }

    // Ancre invisible du tooltip : 0 sur chaque point d'indispo observé (tout
    // point sans temps réel avant « maintenant »), y compris ceux sans statut
    // précis — le survol d'une barre grise affiche alors « Indisponible ».
    for (const d of data) {
      d.downMarker = d.t <= nowMs && d.actual == null ? 0 : null;
    }

    return { data, xMin, xMax, yMax, yTicks, xTicks, nowMs, downBands };
  }, [today, forecast, now, win, timezone]);

  const chartConfig = {
    actual: { label: todayLabel, color: "var(--primary)" },
    forecast: { label: forecastLabel, color: "var(--primary)" },
  } satisfies ChartConfig;

  const showNow = nowMs >= xMin && nowMs <= xMax;

  // Tooltip au survol : heure + temps par série, en filtrant les séries à valeur
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
    // On exclut l'ancre invisible (downMarker) des lignes numériques affichées.
    let rows = payload.filter(
      (p) => p.value != null && p.dataKey !== "downMarker",
    );
    // Au point de raccord (« Maintenant »), le dernier temps observé amorce aussi
    // la prévision : les deux séries portent la MÊME valeur au même instant. On
    // n'affiche alors que le temps observé (pas de doublon « Aujourd'hui +
    // Prévision »), pour ne montrer que le temps actuel. Ailleurs, un point n'a
    // de toute façon qu'une seule des deux séries.
    if (rows.some((p) => p.dataKey === "actual")) {
      rows = rows.filter((p) => p.dataKey === "actual");
    }

    // Aucune valeur numérique => on survole une plage d'indispo : on affiche le
    // statut (fermé / en panne / maintenance) avec sa pastille de couleur. Tout
    // autre cas (statut « open »/-1/inconnu, barre grise) = « Indisponible ».
    if (!rows.length) {
      const rowData = payload[0]?.payload;
      const status = rowData?.status;
      const label =
        status === "closed"
          ? tStatus("closed")
          : status === "down"
            ? tStatus("down")
            : status === "maintenance"
              ? tStatus("maintenance")
              : tStatus("unavailable");
      return (
        <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
          {rowData?.t != null && (
            <div className="mb-1 font-medium">{fmtTime(rowData.t)}</div>
          )}
          <div className="flex items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-[2px]"
              style={{ background: downColor(status) }}
            />
            <span className="text-muted-foreground">{label}</span>
          </div>
        </div>
      );
    }

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
                {r.dataKey === "actual" ? actualLabel : forecastLabel}
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
      <LineChart data={data} margin={{ top: 18, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid vertical horizontal strokeDasharray="3 3" />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={[xMin, xMax]}
          ticks={xTicks}
          interval="preserveStartEnd"
          tickFormatter={fmtTime}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
        />
        <YAxis
          domain={[0, yMax]}
          ticks={yTicks}
          width={40}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        {/* Indispo pendant la journée : fine barre posée sur la ligne 0, colorée
            par statut (rouge fermé/maintenance, orange en panne), même épaisseur
            que les courbes, au lieu d'un trou. Un segment de ReferenceLine =>
            épaisseur FIXE en pixels (indépendante de l'échelle). */}
        {downBands.map((b) => (
          <ReferenceLine
            key={`down-${b.x1}`}
            segment={[
              { x: b.x1, y: 0 },
              { x: b.x2, y: 0 },
            ]}
            stroke={b.color}
            strokeWidth={3}
            ifOverflow="visible"
          />
        ))}
        {showNow && (
          <ReferenceLine
            x={nowMs}
            stroke="var(--primary)"
            strokeOpacity={0.4}
            strokeDasharray="2 3"
            label={{
              value: nowLabel,
              // « top » : au-dessus de la zone de tracé (la marge top réservée
              // ci-dessus l'accueille) pour ne PLUS chevaucher les points.
              position: "top",
              fontSize: 10,
              fill: "var(--primary)",
            }}
          />
        )}
        <ChartTooltip content={<WaitTooltip />} />
        {/* Ancre invisible : porte une valeur (0) sur les points d'indispo pour
            que le tooltip s'active au survol de la barre basse. Aucun trait/point
            visible. */}
        <Line
          dataKey="downMarker"
          stroke="transparent"
          dot={false}
          activeDot={false}
          connectNulls={false}
          isAnimationActive={false}
          legendType="none"
        />
        {/* Animation active + courte : quand la prévision se met à jour (popup
            ouvert), la courbe se redessine en douceur au lieu de sauter. */}
        <Line
          name={todayLabel}
          dataKey="actual"
          type="monotone"
          stroke="var(--color-actual)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          connectNulls={false}
          isAnimationActive
          animationDuration={350}
          animationEasing="ease-in-out"
        />
        <Line
          name={forecastLabel}
          dataKey="forecast"
          type="monotone"
          stroke="var(--color-forecast)"
          strokeOpacity={0.6}
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
          activeDot={{ r: 4 }}
          connectNulls={false}
          isAnimationActive
          animationDuration={350}
          animationEasing="ease-in-out"
        />
      </LineChart>
    </ChartContainer>
  );
}
