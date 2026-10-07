"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { DateTime } from "luxon";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
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
import { cn } from "@/lib/utils";
import type { TimedPoint } from "@/types/rideHistory";
import { formatWaitMinutes, type WaitCap } from "@/lib/wait-time-cap";

type WaitTimeChartProps = {
  today: TimedPoint[];
  forecast: TimedPoint[];
  /**
   * Ce qui avait été annoncé UNE HEURE AVANT pour les heures déjà passées (la
   * route ne sert que les points échus). Tracé en gris sous la courbe réelle —
   * voir la série `trail` plus bas.
   */
  forecastTrail?: TimedPoint[];
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
  /** Libellé de la trace grise dans le tooltip (« Prédiction »). */
  trailLabel?: string;
  /** Plafond de publication de la source : 91 s'affiche « 90+ ». */
  waitCap?: WaitCap | null;
  /**
   * Rendu resserré : moins haut, axe des temps plus étroit, moins de graduations
   * horaires. Utilisé par la démo de la page À propos, qui vit dans une vignette
   * de grille et non dans la largeur d'un popup.
   */
  compact?: boolean;
  /**
   * Seuil d'alerte à matérialiser (ligne horizontale verte) : celui qu'on règle
   * dans le popup, ou celui de l'alerte active. Hors de l'axe, il n'est pas
   * tracé — l'axe ne s'étire pas pour lui.
   */
  threshold?: { value: number; label: string } | null;
};

// ⚠️ Plus de bande d'incertitude « ± X min » autour de la prévision : elle a été
// retirée du graphique (l'`Area` de plage, sa légende et sa mention dans le
// tooltip), ce qui permet de revenir à un simple `LineChart`. La marge d'erreur
// MESURÉE n'a pas disparu du produit pour autant : elle reste dite en toutes
// lettres sous le graphique (`chart-section.tsx`), là où elle se lit sans
// encombrer la courbe. Ne pas remettre `ComposedChart` sans raison.
type ChartRow = {
  t: number;
  actual: number | null;
  forecast: number | null;
  // Prévision ÉCOULÉE, figée : ce qui était annoncé pour cet instant avant qu'il
  // ne devienne du passé.
  trail: number | null;
  // Valeur « Prévu » lue par le TOOLTIP sur un point observé — jamais tracée.
  // Distincte de `trail` : la trace n'a pas forcément un point au même instant
  // que la courbe réelle (cadences différentes). Voir son calcul plus bas.
  expected?: number | null;
  // Statut d'indispo (quand actual == null) : colore la barre basse + tooltip.
  status?: string | null;
  // Ancre invisible : vaut 0 sur les points d'indispo, null ailleurs. Sert
  // uniquement à garantir une entrée dans le payload du tooltip au survol d'une
  // plage d'indispo (recharts n'inclut pas les séries à valeur nulle).
  downMarker?: number | null;
  // Point observé sans voisin observé, de part et d'autre : la courbe ne peut
  // y tracer aucun segment. Seuls ces points reçoivent un `dot` visible.
  isolated?: boolean;
};

// Plage temporelle (indispo pendant les heures d'ouverture) tracée en barre
// basse plutôt qu'en trou dans la courbe. `color` déduit du statut.
type DownBand = {
  x1: number;
  x2: number;
  color: string;
  roundStart?: boolean;
  roundEnd?: boolean;
};

// Épaisseur (px) commune à la courbe du jour, à la prévision et aux barres
// d'indispo — elles se lisent comme un seul tracé — et diamètre de la pastille
// d'un point observé isolé. Seule la trace « Prédiction », repère de second
// plan, est plus fine.
const LINE_WIDTH = 2.5;

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
  forecastTrail,
  window: win,
  now,
  timezone,
  nowLabel,
  todayLabel,
  actualLabel,
  forecastLabel,
  trailLabel,
  waitCap,
  compact = false,
  threshold,
}: WaitTimeChartProps) {
  const { is12Hour } = useTimeFormat();
  const tStatus = useTranslations("attractionStatus");

  const fmtTime = (ms: number) =>
    DateTime.fromMillis(ms)
      .setZone(timezone)
      .toFormat(is12Hour ? "h:mm a" : "HH:mm");

  const {
    data,
    xMin,
    xMax,
    yMax,
    yTicks,
    xTicks,
    nowMs,
    downBands,
  } = useMemo(() => {
    const rows = new Map<number, ChartRow>();
    const row = (t: number) => {
      let entry = rows.get(t);
      if (!entry) {
        entry = { t, actual: null, forecast: null, trail: null };
        rows.set(t, entry);
      }
      return entry;
    };

    for (const p of today) {
      const r = row(Date.parse(p.t));
      r.actual = p.waitTime;
      r.status = p.status;
    }
    // `p.margin` existe toujours dans la réponse de l'API (le worker la calcule
    // par point), mais le graphique ne s'en sert plus : la marge est désormais
    // dite en texte sous la courbe, pas dessinée dessus.
    // Raccord : le dernier point observé amorce la prévision (voir plus bas).
    const lastActual = [...today].reverse().find((p) => p.waitTime != null);
    const lastActualMs = lastActual ? Date.parse(lastActual.t) : null;

    for (const p of forecast) {
      const t = Date.parse(p.t);
      // La courbe observée va jusqu'à « maintenant » (`sampleDaySeries`) ; un
      // point de prévision calé sur un pas déjà échu tomberait AVANT son point
      // de départ et dessinerait un pointillé à rebours.
      if (lastActualMs != null && t <= lastActualMs) continue;
      const r = row(t);
      r.forecast = p.waitTime;
    }
    // Trace des prévisions écoulées. Elle ne couvre que le passé, donc elle ne
    // chevauche jamais `forecast` — et ne s'y raccorde pas (voir plus bas).
    // ⚠️ La route y ajoute le premier point À VENIR : il n'est pas tracé, il
    // sert à prolonger la trace jusqu'à « maintenant », comme la courbe
    // observée, au lieu de l'arrêter au dernier pas échu.
    const nowLimitMs = Date.parse(now);
    let trailBefore: { t: number; v: number } | null = null;
    let trailAfter: { t: number; v: number } | null = null;
    const trailStepMs: number[] = [];
    for (const p of forecastTrail ?? []) {
      const t = Date.parse(p.t);
      if (p.waitTime != null) {
        if (t <= nowLimitMs && (!trailBefore || t > trailBefore.t)) {
          trailBefore = { t, v: p.waitTime };
        }
        if (t > nowLimitMs && (!trailAfter || t < trailAfter.t)) {
          trailAfter = { t, v: p.waitTime };
        }
      }
      if (t > nowLimitMs) continue;
      const r = row(t);
      r.trail = p.waitTime;
    }
    // Pas de prolongement par-dessus un trou de la trace (créneau habituellement
    // fermé) : même garde que pour `expected`, un écart au plus d'un pas et demi.
    const trailTimes = (forecastTrail ?? [])
      .map((p) => Date.parse(p.t))
      .sort((a, b) => a - b);
    for (let i = 1; i < trailTimes.length; i++) {
      trailStepMs.push(trailTimes[i] - trailTimes[i - 1]);
    }
    const trailStep = trailStepMs.length ? Math.min(...trailStepMs) : 0;
    if (
      trailBefore &&
      trailAfter &&
      trailBefore.t < nowLimitMs &&
      trailAfter.t - trailBefore.t <= trailStep * 1.5
    ) {
      row(nowLimitMs).trail = Math.round(
        trailBefore.v +
          ((trailAfter.v - trailBefore.v) * (nowLimitMs - trailBefore.t)) /
            (trailAfter.t - trailBefore.t),
      );
    }

    // Raccord : le dernier point observé amorce aussi la prévision (continuité
    // solide -> pointillé).
    if (lastActual && lastActualMs != null) {
      const r = row(lastActualMs);
      r.forecast = lastActual.waitTime;
    }

    // ⚠️ PAS de raccord entre la trace et la prévision en cours. La trace est ce
    // qu'on annonçait UNE HEURE avant chaque instant : la prolonger jusqu'au
    // premier point de la prévision actuelle lui ferait afficher, sur son
    // dernier segment, une valeur annoncée maintenant — exactement la confusion
    // qui rendait la courbe grise identique à la réelle décalée d'un quart
    // d'heure (cf. `buildForecastTrail` côté worker). Elle s'arrête donc à son
    // dernier point échu.

    // ⚠️ **Les trous de la prévision doivent ROMPRE la courbe.** Le worker
    // n'émet AUCUN point sur les créneaux où l'attraction est habituellement
    // fermée — un trou, délibérément, plutôt qu'un 0 trompeur. Mais
    // `connectNulls={false}` ne rompt que sur un `null` EXPLICITE, pas sur une
    // ligne absente du tableau : recharts reliait donc les deux bords du trou
    // par un segment franc, sur lequel aucun point ne répond au survol.
    // Observé sur Aerophile (Disney Springs), 20 points au pas de 15 min avec
    // un trou de 8 h 30 entre 13:00 et 21:30 : la courbe annonçait « 0 min »
    // sans interruption de 10:00 à 23:00.
    //
    // Le pas de référence est le plus PETIT écart de la série, pas une
    // constante : il varie d'une attraction à l'autre, et le déduire des
    // données évite qu'un changement de cadence côté worker ne rouvre le trou.
    const fcTimes = forecast
      .map((p) => Date.parse(p.t))
      .filter((t) => !Number.isNaN(t))
      .sort((a, b) => a - b);
    if (fcTimes.length > 1) {
      const step = Math.min(
        ...fcTimes.slice(1).map((t, i) => t - fcTimes[i]),
      );
      if (step > 0) {
        for (let i = 1; i < fcTimes.length; i++) {
          const from = fcTimes[i - 1];
          const to = fcTimes[i];
          if (to - from <= step * 1.5) continue;
          // Une ligne déjà présente dans l'intervalle vient forcément de la
          // courbe observée, donc sa prévision est nulle : la rupture existe
          // déjà et en ajouter une couperait la courbe observée en deux.
          const alreadyBroken = [...rows.keys()].some(
            (t) => t > from && t < to,
          );
          if (!alreadyBroken) row(from + Math.floor((to - from) / 2));
        }
      }
    }

    const data = [...rows.values()].sort((a, b) => a.t - b.t);

    // ⚠️ **Un point observé isolé est INVISIBLE sans dot.** `connectNulls={false}`
    // + `dot={false}` : un segment a besoin de deux points, une valeur encadrée
    // de `null` ne dessine donc rien. Une attraction qui n'ouvre qu'un quart
    // d'heure dans une matinée de panne ne laissait aucune trace sur le
    // graphique — seul le survol la révélait (Pirates of the Caribbean,
    // 2026-10-05, 5 min à 10:15 entre deux plages de panne). Calculé sur les
    // lignes RENDUES et non sur `today` : c'est leur voisinage qui décide si
    // recharts trace un segment.
    for (let i = 0; i < data.length; i++) {
      if (data[i].actual == null) continue;
      const prevNull = i === 0 || data[i - 1].actual == null;
      const nextNull = i === data.length - 1 || data[i + 1].actual == null;
      data[i].isolated = prevNull && nextNull;
    }

    // Ce qui était prévu à chaque instant OBSERVÉ, pour que le survol de la
    // courbe réelle confronte les deux valeurs. Lu dans la trace et interpolé
    // entre ses deux points voisins quand elle n'a pas de point au même instant.
    // Pas d'interpolation par-dessus un trou de la trace (créneau habituellement
    // fermé, passages manqués côté worker) : on n'invente pas une prévision qui
    // n'a jamais été faite.
    const trailPts = (forecastTrail ?? [])
      .map((p) => ({ t: Date.parse(p.t), v: p.waitTime }))
      .filter(
        (p): p is { t: number; v: number } =>
          !Number.isNaN(p.t) && p.v != null,
      )
      .sort((a, b) => a.t - b.t);
    if (trailPts.length) {
      const trailStep =
        trailPts.length > 1
          ? Math.min(...trailPts.slice(1).map((p, i) => p.t - trailPts[i].t))
          : 0;
      for (const d of data) {
        // Pas de filtre sur `actual` : une plage d'indispo (fermé, panne…) a
        // elle aussi sa valeur prévue au survol. Une ligne de prévision pure,
        // elle, n'en reçoit pas : le seul point de trace à venir est là pour
        // « maintenant », pas pour doubler la prévision en cours.
        if (d.t > nowLimitMs) continue;
        const i = trailPts.findIndex((p) => p.t >= d.t);
        if (i === -1) continue;
        const b = trailPts[i];
        if (b.t === d.t) {
          d.expected = b.v;
          continue;
        }
        const a = trailPts[i - 1];
        if (!a || b.t - a.t > trailStep * 1.5) continue;
        d.expected = Math.round(a.v + ((b.v - a.v) * (d.t - a.t)) / (b.t - a.t));
      }
    }

    const nowMs = Date.parse(now);

    // NB : on NE ponte PAS les trous de la courbe du jour. Une valeur manquante
    // (indispo/fermé/panne) reste `null` — la courbe s'y rompt et une barre basse
    // colorée est tracée à la place (voir downBands). La continuité visuelle est
    // obtenue en faisant TOUCHER cette barre aux points connus voisins (bornes
    // étendues plus bas), pas en inventant des valeurs.

    const values = data
      .flatMap((d) => [d.actual, d.forecast, d.trail])
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
    // En rendu resserré, la même règle avec moins d'intervalles : la largeur
    // d'une vignette de grille ne tient pas 6 libellés d'heure.
    const maxIntervals = compact ? 3 : 5;
    const stepHours =
      [1, 2, 3, 4, 6, 12].find((s) => spanHours / s <= maxIntervals) ?? 24;
    const stepMs = stepHours * HOUR_MS;

    // ⚠️ **La grille se compte À REBOURS DEPUIS LA FERMETURE**, pas depuis
    // l'ouverture. L'axe porte deux graduations imposées — l'ouverture et la
    // fermeture — et une grille régulière ne peut se caler que sur UNE des deux ;
    // l'écart bâtard se retrouve forcément à l'autre bout. Posé à droite, il
    // tombait juste là où l'œil compare : Halloween Horror Nights
    // (18:30 – 02:00, pas de 2 h) donnait 18:30 · 21:00 · 23:00 · 02:00, soit
    // 2 h 30 puis 2 h puis 3 h. Ancré sur la fermeture : 18:30 · 20:00 · 22:00 ·
    // 00:00 · 02:00 — toutes les graduations tombent sur des heures rondes et le
    // seul écart irrégulier est le premier, contre l'ouverture, où il se lit
    // comme un début de journée et non comme une erreur de grille.
    //
    // ⚠️ Rien ne change pour une journée qui ouvre à l'heure pile (09:00 – 17:00
    // reste 09:00 · 11:00 · 13:00 · 15:00 · 17:00) : les deux ancrages coïncident
    // alors exactement.
    //
    // Un tick à moins d'un DEMI-PAS d'une borne est écarté : c'est ce qui
    // empêche « 01:00 » de venir se coller à « 02:00 » (les deux libellés se
    // touchaient dans la largeur du popup), et une heure pleine de doubler une
    // ouverture à 10:45.
    const xTicks: number[] = [xMin];
    const minGap = stepMs / 2;
    const inner: number[] = [];
    let cur = DateTime.fromMillis(xMax).setZone(timezone).startOf("hour");
    while (cur.toMillis() > xMin + minGap) {
      const ms = cur.toMillis();
      if (ms < xMax - minGap) inner.push(ms);
      cur = cur.minus({ hours: stepHours });
    }
    xTicks.push(...inner.reverse(), xMax);

    // Plages d'indispo observées (actual == null avant « maintenant ») : au lieu
    // d'un trou dans la courbe, une barre basse colorée par statut. On fusionne
    // les points consécutifs de MÊME couleur. Les bornes de la barre s'ÉTENDENT
    // jusqu'au point CONNU voisin (là où passe la courbe) pour que barre et trait
    // SE TOUCHENT (plus de petit trou entre les deux, cf. retour utilisateur).
    // Partout ailleurs, un état vaut JUSQU'À LA MESURE SUIVANTE qui en montre un
    // autre (voir les bords plus bas). Un i final « hors tableau » ferme la
    // dernière plage.
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
        // ⚠️ **Les frontières tombent SUR une mesure, jamais entre deux.** Un
        // point échantillonné donne l'état à un instant ; l'instant exact du
        // changement, entre deux mesures, est inconnu. On retenait le milieu
        // (09:37:30 entre « fermé » à 09:30 et « en panne » à 09:45) : la
        // frontière tombait là où le survol, qui se cale sur les mesures, ne
        // s'arrête jamais. Règle désormais : un état vaut jusqu'à la mesure
        // qui en montre un autre — la frontière est sur 09:45, et le survol de
        // chaque côté dit la couleur qu'on voit.
        //
        // Bord droit : la mesure suivante, quelle qu'elle soit (courbe, autre
        // plage). Dernière plage : elle court jusqu'à « maintenant », sinon une
        // plage d'une seule mesure en fin de série n'aurait aucune largeur.
        //
        // ⚠️ Exception : un point observé ISOLÉ (`isolated`) — une ouverture
        // éclair entre deux plages d'indispo. La barre s'y arrête à MI-CHEMIN
        // des deux mesures, de chaque côté : la trouée est centrée sur sa
        // pastille. Ces milieux sont exactement là où le survol bascule d'une
        // mesure à la voisine (il se cale sur la plus proche), donc chaque
        // position du curseur tombe sur ce qu'elle annonce. Essais écartés
        // (Pirates of the Caribbean, 2026-10-05, 10:15) : barre continue sous
        // la pastille (ouvert ET fermé au même instant), trouée calée sur les
        // mesures (vide d'un côté de la pastille), palier en marche d'escalier
        // pour la combler (lourd à l'œil).
        const x2 = next
          ? next.isolated
            ? (todayPts[end].t + next.t) / 2
            : next.t
          : Math.max(todayPts[end].t, Math.min(nowMs, xMax));
        // Bord gauche : la plage commence sur sa propre première mesure, SAUF
        // après une courbe, qu'elle rejoint sur son dernier point — barre et
        // trait doivent se toucher (aucune courbe ne prolonge ce point) — et
        // après un point isolé (mi-chemin, cf. ci-dessus).
        const x1 = !prev
          ? todayPts[runStart].t
          : prev.isolated
            ? (prev.t + todayPts[runStart].t) / 2
            : prev.actual != null
              ? prev.t
              : todayPts[runStart].t;
        if (x2 > x1) downBands.push({ x1, x2, color: runColor });
        runStart = -1;
      }
      if (isDown && runStart === -1) runStart = i;
    }

    // Bouts arrondis : seulement là où la barre s'arrête vraiment. Une
    // frontière entre deux plages contiguës (rouge -> orange) reste franche —
    // deux arrondis s'y chevauchaient en un bourrelet.
    for (const b of downBands) {
      b.roundStart = !downBands.some((o) => o !== b && o.x2 === b.x1);
      b.roundEnd = !downBands.some((o) => o !== b && o.x1 === b.x2);
    }

    // Ancre invisible du tooltip : 0 sur chaque point d'indispo observé (tout
    // point sans temps réel avant « maintenant »), y compris ceux sans statut
    // précis — le survol d'une barre grise affiche alors « Indisponible ».
    for (const d of data) {
      d.downMarker = d.t <= nowMs && d.actual == null ? 0 : null;
    }

    return {
      data,
      xMin,
      xMax,
      yMax,
      yTicks,
      xTicks,
      nowMs,
      downBands,
    };
  }, [today, forecast, forecastTrail, now, win, timezone, compact]);

  const chartConfig = {
    actual: { label: todayLabel, color: "var(--primary)" },
    forecast: { label: forecastLabel, color: "var(--primary)" },
    // Gris neutre et non une déclinaison du primaire : la trace est un repère
    // de second plan, elle ne doit pas se disputer la lecture avec la courbe
    // réelle qu'elle accompagne.
    trail: { label: trailLabel ?? forecastLabel, color: "var(--muted-foreground)" },
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
    //
    // Sur un instant passé — observé OU indisponible — on ajoute ce qui ÉTAIT
    // PRÉVU pour cet instant (`expected`, voir son calcul), pour lire l'écart
    // d'un coup d'œil. Il vient de la ligne de données et non du payload de la
    // série `trail`, qui n'a pas forcément de point à cet instant.
    const rowData = payload[0]?.payload;
    // Plage d'indispo observée (fermé / panne / maintenance…) : l'ancre
    // `downMarker` vaut 0 exactement sur ces lignes.
    const isDown = rowData?.downMarker === 0;
    const actualRow = rows.find((p) => p.dataKey === "actual");
    if (actualRow || isDown) {
      rows = actualRow ? [actualRow] : [];
      const expected = rowData?.expected;
      if (expected != null) {
        rows.push({
          dataKey: "trail",
          value: expected,
          color: "var(--color-trail)",
          payload: rowData,
        });
      }
    }

    // ⚠️ Le statut d'indispo s'affiche MÊME quand une autre valeur accompagne
    // la ligne. Il ne s'affichait auparavant que si AUCUNE valeur numérique
    // n'était présente : dès que la trace « Prévu » couvrait la plage, le survol
    // d'une barre rouge ne montrait plus que « Prévu 30 min », sans dire que
    // l'attraction était fermée (constaté sur Indiana Jones, 2026-10-05).
    // Statut « open »/-1/inconnu (barre grise) = « Indisponible ».
    const status = rowData?.status;
    const downLabel = !isDown
      ? null
      : status === "closed"
        ? tStatus("closed")
        : status === "down"
          ? tStatus("down")
          : status === "maintenance"
            ? tStatus("maintenance")
            : tStatus("unavailable");

    if (!rows.length && !downLabel) return null;

    const ms = rowData?.t;
    return (
      <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
        {ms != null && <div className="mb-1 font-medium">{fmtTime(ms)}</div>}
        <div className="grid gap-1">
          {downLabel && (
            <div className="flex items-center gap-2">
              {/* Trait plein : l'indispo est tracée en barre sur la ligne 0. */}
              <span
                className="w-4 shrink-0 border-t-2"
                style={{ borderColor: downColor(status) }}
              />
              <span className="text-muted-foreground">{downLabel}</span>
            </div>
          )}
          {rows.map((r) => (
            <div key={String(r.dataKey)} className="flex items-center gap-2">
              {/* Le repère reprend le trait de sa courbe, comme la légende :
                  plein pour l'observé, pointillé pour les deux séries tracées
                  en pointillé. Sans quoi « Temps d'attente » et « Prévision »
                  portaient le même carré orange. */}
              <span
                className={`w-4 shrink-0 border-t-2 ${
                  r.dataKey === "actual" ? "" : "border-dashed"
                }`}
                style={{ borderColor: r.color }}
              />
              <span className="text-muted-foreground">
                {r.dataKey === "actual"
                  ? actualLabel
                  : r.dataKey === "trail"
                    ? (trailLabel ?? forecastLabel)
                    : forecastLabel}
              </span>
              <span className="ml-auto font-mono font-medium tabular-nums">
                {formatWaitMinutes(r.value as number, waitCap)} min
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className={cn("aspect-auto w-full", compact ? "h-[132px]" : "h-[180px]")}
    >
      {/* Marge droite = demi-libellé d'heure. La graduation de FERMETURE est
          posée pile sur le bord droit de la zone de tracé : sans cette marge,
          recharts en rogne la moitié (« 22:00 » s'affichait « 22:0 »). C'est
          `interval="preserveStartEnd"` qui recalait auparavant la dernière
          graduation vers l'intérieur ; `interval={0}` (voir XAxis) ne le fait
          pas, c'est donc à la marge de réserver la place. */}
      <LineChart
        data={data}
        margin={{
          top: 18,
          right: compact ? 14 : 20,
          left: compact ? -18 : -10,
          bottom: 0,
        }}
      >
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
          fontSize={compact ? 10 : undefined}
        />
        <YAxis
          domain={[0, yMax]}
          ticks={yTicks}
          tickFormatter={(v: number) => formatWaitMinutes(v, waitCap)}
          width={compact ? 34 : 40}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          fontSize={compact ? 10 : undefined}
        />
        {/* Indispo pendant la journée : fine barre posée sur la ligne 0, colorée
            par statut (rouge fermé/maintenance, orange en panne), même épaisseur
            que les courbes, au lieu d'un trou. Un segment de ReferenceLine =>
            épaisseur FIXE en pixels (indépendante de l'échelle). */}
        {/* Bouts francs (`butt`) + demi-disques posés sur les seuls bouts
            libres (`roundStart` / `roundEnd`) : `strokeLinecap` s'applique aux
            DEUX bouts d'un segment, il ne permet pas de n'en arrondir qu'un. */}
        {downBands.flatMap((b) => [
          <ReferenceLine
            key={`down-${b.x1}`}
            segment={[
              { x: b.x1, y: 0 },
              { x: b.x2, y: 0 },
            ]}
            stroke={b.color}
            strokeWidth={LINE_WIDTH}
            ifOverflow="visible"
          />,
          ...[b.roundStart && b.x1, b.roundEnd && b.x2]
            .filter((x): x is number => typeof x === "number")
            .map((x) => (
              <ReferenceDot
                key={`down-cap-${b.x1}-${x}`}
                x={x}
                y={0}
                r={LINE_WIDTH / 2}
                fill={b.color}
                stroke="none"
                ifOverflow="visible"
              />
            )),
        ])}
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
        {threshold && (
          <ReferenceLine
            y={threshold.value}
            stroke="#22c55e"
            strokeWidth={1.5}
            strokeDasharray="2 3"
            label={{
              value: threshold.label,
              position: "insideTopRight",
              fontSize: 10,
              fontWeight: 600,
              fill: "#22c55e",
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
        {/* Trace des prévisions écoulées. Déclarée AVANT les deux autres pour
            passer DESSOUS : c'est un repère de comparaison, la courbe réelle
            garde la priorité de lecture là où les deux se croisent. */}
        <Line
          name={trailLabel ?? forecastLabel}
          dataKey="trail"
          type="monotone"
          stroke="var(--color-trail)"
          strokeOpacity={0.45}
          strokeWidth={1.5}
          strokeDasharray="3 3"
          dot={false}
          activeDot={{ r: 3 }}
          connectNulls={false}
          isAnimationActive={false}
        />
        {/* Animation active + courte : quand la prévision se met à jour (popup
            ouvert), la courbe se redessine en douceur au lieu de sauter. */}
        <Line
          name={todayLabel}
          dataKey="actual"
          type="monotone"
          stroke="var(--color-actual)"
          strokeWidth={LINE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          // Pastille uniquement sur les points isolés (voir `isolated`) : sur
          // une courbe continue, des dots partout l'alourdiraient. Diamètre =
          // épaisseur du trait.
          dot={(props: {
            key?: string;
            cx?: number;
            cy?: number;
            payload?: ChartRow;
          }) =>
            props.payload?.isolated && props.cx != null && props.cy != null ? (
              <circle
                key={props.key}
                cx={props.cx}
                cy={props.cy}
                r={LINE_WIDTH / 2}
                fill="var(--color-actual)"
              />
            ) : (
              <g key={props.key} />
            )
          }
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
          strokeWidth={LINE_WIDTH}
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
