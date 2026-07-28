"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { DateTime } from "luxon";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
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
  // Libellé de la marge d'erreur dans le tooltip, ex. « ± {minutes} min ».
  marginLabel: (minutes: number) => string;
};

type ChartRow = {
  t: number;
  actual: number | null;
  forecast: number | null;
  // Bande d'incertitude [bas, haut] autour de la prévision. Recharts rend un
  // `Area` en « plage » quand la valeur est un couple. null = marge inconnue
  // (pas encore assez de mesures) -> aucune bande, plutôt qu'une bande inventée.
  band?: [number, number] | null;
  // Marge (± minutes) du point de prévision, pour le tooltip.
  margin?: number | null;
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
  marginLabel,
}: WaitTimeChartProps) {
  const { is12Hour } = useTimeFormat();
  const tStatus = useTranslations("attractionStatus");

  const fmtTime = (ms: number) =>
    DateTime.fromMillis(ms)
      .setZone(timezone)
      .toFormat(is12Hour ? "h:mm a" : "HH:mm");

  const { data, xMin, xMax, yMax, yTicks, xTicks, nowMs, downBands, hasBand } = useMemo(() => {
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
    // Bande d'incertitude : chaque point de prévision porte SA marge, mesurée à
    // un horizon comparable sur les jours précédents (l'erreur croît avec
    // l'horizon — une marge unique pour toute la courbe serait trompeuse).
    let hasBand = false;
    for (const p of forecast) {
      const r = row(Date.parse(p.t));
      r.forecast = p.waitTime;
      if (p.waitTime != null && p.margin != null && p.margin > 0) {
        r.margin = p.margin;
        r.band = [Math.max(0, p.waitTime - p.margin), p.waitTime + p.margin];
        hasBand = true;
      }
    }

    // Raccord : le dernier point observé amorce aussi la prévision (continuité
    // solide -> pointillé).
    const lastActual = [...today].reverse().find((p) => p.waitTime != null);
    if (lastActual) {
      const r = row(Date.parse(lastActual.t));
      r.forecast = lastActual.waitTime;
      // La bande part d'une largeur NULLE sur le point observé : à l'instant
      // présent le temps d'attente est connu, l'incertitude ne s'ouvre qu'en
      // avançant. Sans ce point d'ancrage, la bande commencerait « en marche
      // d'escalier » au premier point de prévision.
      if (hasBand && lastActual.waitTime != null) {
        r.band = [lastActual.waitTime, lastActual.waitTime];
      }
    }

    const data = [...rows.values()].sort((a, b) => a.t - b.t);

    const nowMs = Date.parse(now);

    // NB : on NE ponte PAS les trous de la courbe du jour. Une valeur manquante
    // (indispo/fermé/panne) reste `null` — la courbe s'y rompt et une barre basse
    // colorée est tracée à la place (voir downBands). La continuité visuelle est
    // obtenue en faisant TOUCHER cette barre aux points connus voisins (bornes
    // étendues plus bas), pas en inventant des valeurs.

    // La borne haute de l'axe doit englober le HAUT de la bande, sinon celle-ci
    // se retrouve rognée par le cadre.
    const values = data
      .flatMap((d) => [d.actual, d.forecast, d.band?.[1] ?? null])
      .filter((v): v is number => v != null);
    const times = data.map((d) => d.t);
    const xMin = win ? Date.parse(win.open) : Math.min(...times, nowMs);
    const xMax = win ? Date.parse(win.close) : Math.max(...times, nowMs);

    // Axe Y : borne haute arrondie au pas propre, graduations = multiples de 5.
    const rawMax = values.length ? Math.max(...values) : 0;
    const step = niceStep(Math.max(10, rawMax));
    const yMax = Math.max(step, Math.ceil(Math.max(10, rawMax) / step) * step);
    const yTicks: number[] = [];
    for (let v = 0; v <= yMax; v += step) yTicks.push(v);

    // Axe X : ouverture, fermeture, et heures pleines entre les deux — avec un
    // PAS adapté à l'amplitude de la journée.
    //
    // Une graduation par heure ne tient pas dans la largeur du popup : recharts
    // en supprimait alors une « au milieu » (on lisait 10:00 … 15:00 puis 17:00,
    // sans 16:00), ce qui donnait un axe irrégulier sans raison visible. On
    // choisit donc nous-mêmes un pas qui laisse au plus 5 intervalles, et l'axe
    // affiche EXACTEMENT ces graduations (`interval={0}` côté XAxis).
    const HOUR_MS = 3_600_000;
    const spanHours = (xMax - xMin) / HOUR_MS;
    const stepHours = [1, 2, 3, 4, 6, 12].find((s) => spanHours / s <= 5) ?? 24;
    const stepMs = stepHours * HOUR_MS;

    const xTicks: number[] = [xMin];
    // On démarre à la première heure pleine située à AU MOINS un pas de
    // l'ouverture, et on s'arrête un DEMI-pas avant la fermeture : sans ces deux
    // marges, la première (ou la dernière) graduation viendrait se coller à
    // l'heure d'ouverture/fermeture avec un écart deux fois plus petit que les
    // autres — le défaut qu'on cherche justement à corriger.
    let cur = DateTime.fromMillis(xMin + stepMs).setZone(timezone).startOf("hour");
    if (cur.toMillis() < xMin + stepMs) cur = cur.plus({ hours: 1 });
    const lastAllowed = xMax - stepMs / 2;
    while (cur.toMillis() <= lastAllowed) {
      xTicks.push(cur.toMillis());
      cur = cur.plus({ hours: stepHours });
    }
    xTicks.push(xMax);

    // Plages d'indispo observées (actual == null avant « maintenant ») : au lieu
    // d'un trou dans la courbe, une barre basse colorée par statut. On fusionne
    // les points consécutifs de MÊME couleur. Les bornes de la barre s'ÉTENDENT
    // jusqu'au point CONNU voisin (là où passe la courbe) pour que barre et trait
    // SE TOUCHENT (plus de petit trou entre les deux, cf. retour utilisateur).
    // Si le voisin est lui-même une indispo (autre plage de couleur), on retombe
    // au point milieu pour ne pas chevaucher la plage adjacente. Un i final
    // « hors tableau » ferme la dernière plage.
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
        const prev = runStart > 0 ? todayPts[runStart - 1] : null;
        const next = end < todayPts.length - 1 ? todayPts[end + 1] : null;
        // Bord gauche : jusqu'au point connu précédent (la courbe y aboutit),
        // sinon milieu (voisin lui aussi indispo), sinon le point lui-même.
        const x1 = prev
          ? prev.actual != null
            ? prev.t
            : (prev.t + todayPts[runStart].t) / 2
          : todayPts[runStart].t;
        // Bord droit : symétrique, jusqu'au point connu suivant.
        const x2 = next
          ? next.actual != null
            ? next.t
            : (todayPts[end].t + next.t) / 2
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

    return { data, xMin, xMax, yMax, yTicks, xTicks, nowMs, downBands, hasBand };
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
    // On exclut l'ancre invisible (downMarker) et la bande d'incertitude (dont
    // la valeur est un COUPLE [bas, haut], pas un temps d'attente) des lignes
    // numériques affichées. La marge est reportée sur la ligne « Prévision ».
    let rows = payload.filter(
      (p) =>
        p.value != null && p.dataKey !== "downMarker" && p.dataKey !== "band",
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
    const margin = rows[0].payload?.margin;
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
                {/* Marge affichée sur la seule ligne de prévision : c'est
                    l'incertitude MESURÉE à cet horizon, pas une décoration. */}
                {r.dataKey === "forecast" && margin != null && (
                  <span className="ml-1 font-normal text-muted-foreground">
                    {marginLabel(margin)}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[180px] w-full">
      {/* Marge droite = demi-libellé d'heure. La graduation de FERMETURE est
          posée pile sur le bord droit de la zone de tracé : sans cette marge,
          recharts en rogne la moitié (« 22:00 » s'affichait « 22:0 »). C'est
          `interval="preserveStartEnd"` qui recalait auparavant la dernière
          graduation vers l'intérieur ; `interval={0}` (voir XAxis) ne le fait
          pas, c'est donc à la marge de réserver la place. */}
      {/* `ComposedChart` et non `LineChart` : la bande d'incertitude est une
          `Area` de plage, que `LineChart` n'accepte pas comme enfant. Le rendu
          des `Line` est identique. */}
      <ComposedChart data={data} margin={{ top: 18, right: 20, left: -10, bottom: 0 }}>
        <CartesianGrid vertical horizontal strokeDasharray="3 3" />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={[xMin, xMax]}
          ticks={xTicks}
          // `interval={0}` : on affiche toutes les graduations calculées, sans
          // laisser recharts en supprimer une pour cause de chevauchement. C'est
          // le calcul du pas ci-dessus qui garantit qu'elles tiennent (au plus
          // 6 libellés) ; avec `preserveStartEnd` + `minTickGap`, recharts
          // parcourait la liste EN PARTANT DE LA FIN et masquait l'avant-dernière
          // heure pleine, seule, au milieu d'une suite par ailleurs régulière.
          interval={0}
          tickFormatter={fmtTime}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
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
        {/* Bande d'incertitude, rendue AVANT les courbes pour passer dessous.
            Sa demi-hauteur est la marge d'erreur RÉELLEMENT mesurée les jours
            précédents à un horizon comparable (table `forecast_accuracy`) : elle
            s'élargit donc naturellement en s'éloignant de « maintenant ».
            Absente tant que la mesure manque — on ne dessine pas une
            incertitude qu'on ne connaît pas. */}
        {hasBand && (
          <Area
            dataKey="band"
            type="monotone"
            fill="var(--color-forecast)"
            fillOpacity={0.12}
            stroke="none"
            connectNulls={false}
            activeDot={false}
            isAnimationActive
            animationDuration={350}
            animationEasing="ease-in-out"
            legendType="none"
          />
        )}
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
      </ComposedChart>
    </ChartContainer>
  );
}
