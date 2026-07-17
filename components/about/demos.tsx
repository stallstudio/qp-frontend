"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import {
  FastForward,
  User,
  Clock,
  CornerDownRight,
  ChevronRight,
  Dices,
  Search as SearchIcon,
} from "lucide-react";
import WaitTrend from "@/components/parks/wait-trend";
import FavoriteStar from "@/components/ui/favorite-star";
import {
  getStatusBadge,
  getWaitTimeBadge,
  getParkStatusDot,
} from "@/lib/badge";
import { WaitTimeStatus } from "@/types/waitTime";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Temps d'attente en direct — Europa-Park                                     */
/* Les temps changent tout seuls et les attractions se réordonnent (le plus    */
/* long remonte), avec une réorganisation animée. Pas de flèches ici.          */
/* -------------------------------------------------------------------------- */

const LIVE_RIDES = [
  { id: "voltron", name: "Voltron Nevera" },
  { id: "bluefire", name: "Blue Fire Megacoaster" },
  { id: "wodan", name: "Wodan Timburcoaster" },
] as const;

const LIVE_POOLS: Record<string, number[]> = {
  voltron: [45, 50, 40, 60, 35],
  bluefire: [25, 20, 30, 15, 35],
  wodan: [60, 70, 50, 40, 65],
};

export function LiveDemo() {
  const [waits, setWaits] = useState<Record<string, number>>({
    voltron: 45,
    bluefire: 25,
    wodan: 60,
  });
  const [flashId, setFlashId] = useState<string | null>(null);
  const cursor = useRef<Record<string, number>>({
    voltron: 0,
    bluefire: 0,
    wodan: 0,
  });
  const tick = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      const ids = LIVE_RIDES.map((r) => r.id);
      const which = ids[tick.current % ids.length];
      tick.current += 1;
      const pool = LIVE_POOLS[which];
      cursor.current[which] = (cursor.current[which] + 1) % pool.length;
      setWaits((w) => ({ ...w, [which]: pool[cursor.current[which]] }));
      setFlashId(which);
      setTimeout(() => setFlashId(null), 600);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const order = [...LIVE_RIDES].sort((a, b) => waits[b.id] - waits[a.id]);

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      {order.map((r) => (
        <motion.div
          layout
          key={r.id}
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
          className={cn(
            "flex items-center justify-between gap-2 rounded-lg px-2 py-1 transition-colors duration-500",
            flashId === r.id && "bg-accent",
          )}
        >
          <span className="font-medium">{r.name}</span>
          {getWaitTimeBadge(waits[r.id])}
        </motion.div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Flèches de tendance — Disneyland Paris                                      */
/* Les temps évoluent en continu et les flèches se recalculent en direct       */
/* (hausse rouge / stable / baisse verte).                                     */
/* -------------------------------------------------------------------------- */

const TREND_RIDES = [
  { id: "btm", name: "Big Thunder Mountain" },
  { id: "hyperspace", name: "Hyperspace Mountain" },
  { id: "phantom", name: "Phantom Manor" },
] as const;

// Chaque attraction monte puis redescend : la flèche passe par les 3 états.
const TREND_POOLS: Record<string, number[]> = {
  btm: [20, 25, 30, 40, 45, 40, 30, 35],
  hyperspace: [35, 30, 25, 20, 15, 15, 25, 45],
  phantom: [15, 15, 20, 25, 20, 15, 10, 15],
};

type TrendState = { cur: number; hist: number[] };

export function TrendDemo() {
  const [state, setState] = useState<Record<string, TrendState>>({
    btm: { cur: 20, hist: [12, 15, 18] },
    hyperspace: { cur: 35, hist: [40, 38, 37] },
    phantom: { cur: 15, hist: [15, 14, 15] },
  });
  const cursor = useRef<Record<string, number>>({
    btm: 0,
    hyperspace: 0,
    phantom: 0,
  });

  useEffect(() => {
    const id = setInterval(() => {
      setState((prev) => {
        const next: Record<string, TrendState> = { ...prev };
        for (const r of TREND_RIDES) {
          const pool = TREND_POOLS[r.id];
          cursor.current[r.id] = (cursor.current[r.id] + 1) % pool.length;
          const cur = pool[cursor.current[r.id]];
          next[r.id] = {
            cur,
            hist: [...prev[r.id].hist.slice(-4), prev[r.id].cur],
          };
        }
        return next;
      });
    }, 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col gap-2.5 text-sm">
      {TREND_RIDES.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-2">
          <span className="font-medium">{r.name}</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-flex w-16 justify-end">
              {getWaitTimeBadge(state[r.id].cur)}
            </span>
            <WaitTrend history={state[r.id].hist} current={state[r.id].cur} />
          </span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Types de files — PortAventura (Shambhala)                                   */
/* Déplié par défaut, mais reste cliquable pour replier/déplier.               */
/* -------------------------------------------------------------------------- */

const QUEUE_ICONS = {
  fastlane: FastForward,
  singlerider: User,
  virtualqueue: Clock,
} as const;

export function QueuesDemo() {
  const [expanded, setExpanded] = useState(true);
  const others: {
    label: string;
    type: keyof typeof QUEUE_ICONS;
    wait: number;
  }[] = [
    { label: "Single Rider", type: "singlerider", wait: 20 },
    { label: "Virtual Queue", type: "virtualqueue", wait: 30 },
  ];

  return (
    <div className="flex flex-col gap-1 text-sm">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setExpanded((v) => !v);
        }}
        className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-accent/50"
      >
        <span className="inline-flex items-center gap-1 font-medium">
          Danse Macabre
          <ChevronRight
            className={cn(
              "size-3.5 transition-transform duration-200",
              expanded && "rotate-90",
            )}
          />
        </span>
        {getWaitTimeBadge(55)}
      </div>

      {expanded &&
        others.map((q) => {
          const Icon = QUEUE_ICONS[q.type];
          return (
            <div
              key={q.type}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1"
            >
              <span className="flex items-center gap-1 ps-6 text-muted-foreground">
                <CornerDownRight className="size-3.5" />
                {q.label}
                <Icon className="size-3.5" />
              </span>
              {getWaitTimeBadge(q.wait)}
            </div>
          );
        })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Favoris — parcs (comme l'accueil : étoile + drapeau à droite) + attractions */
/* (Efteling). Cliquer une étoile épingle le favori en tête.                   */
/* -------------------------------------------------------------------------- */

export function FavoriteDemo() {
  const tFav = useTranslations("favorites");
  const tCard = useTranslations("about.cards.favorites");

  // --- Parcs ---
  const parks: { name: string; status: "open" | "closed"; flag: string }[] = [
    { name: "Europa-Park", status: "open", flag: "germany" },
    { name: "Walibi Belgium", status: "closed", flag: "belgium" },
  ];
  const [parkFav, setParkFav] = useState<Record<string, boolean>>({
    "Europa-Park": true,
    "Walibi Belgium": false,
  });

  // --- Attractions (Parc Astérix) ---
  const rides = [
    { id: "toutatis", name: "Toutatis", wait: 50 },
    { id: "oziris", name: "OzIris", wait: 25 },
    { id: "goudurix", name: "Goudurix", wait: 15 },
  ];
  const [rideFav, setRideFav] = useState<Record<string, boolean>>({
    toutatis: false,
    oziris: false,
    goudurix: false,
  });
  const sortedRides = [...rides].sort(
    (x, y) => Number(rideFav[y.id]) - Number(rideFav[x.id]),
  );

  return (
    <div className="flex flex-col gap-4 text-sm">
      {/* Parcs favoris */}
      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
          {tCard("parksLabel")}
        </p>
        <div className="flex flex-col gap-0.5">
          {parks
            .slice()
            .sort((x, y) => Number(parkFav[y.name]) - Number(parkFav[x.name]))
            .map((p) => {
              const fav = parkFav[p.name];
              return (
                <div
                  key={p.name}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5"
                >
                  <span className="inline-flex items-center font-medium">
                    {p.name}
                    {getParkStatusDot(p.status, "sm", "ml-2")}
                  </span>
                  {/* Comme sur l'accueil : étoile puis drapeau, à droite. */}
                  <div className="flex items-center gap-1.5">
                    <FavoriteStar
                      active={fav}
                      onToggle={() =>
                        setParkFav((s) => ({ ...s, [p.name]: !s[p.name] }))
                      }
                      label={fav ? tFav("removePark") : tFav("addPark")}
                    />
                    <div className={`twa twa-flag-${p.flag} twa-lg`} />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Attractions favorites */}
      <div className="border-t pt-4">
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
          {tCard("ridesLabel")}
        </p>
        <div className="flex flex-col gap-0.5">
          {sortedRides.map((r) => {
            const fav = rideFav[r.id];
            return (
              <motion.div
                layout
                key={r.id}
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1"
              >
                <span className="flex items-center gap-1.5">
                  <FavoriteStar
                    active={fav}
                    onToggle={() =>
                      setRideFav((s) => ({ ...s, [r.id]: !s[r.id] }))
                    }
                    label={fav ? tFav("remove") : tFav("add")}
                  />
                  <span className="font-medium">{r.name}</span>
                </span>
                {getWaitTimeBadge(r.wait)}
              </motion.div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground/70">{tCard("hint")}</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Statuts                                                                     */
/* -------------------------------------------------------------------------- */

export function StatusDemo() {
  const tStatus = useTranslations("attractionStatus");
  const labels: Record<string, string> = {
    open: tStatus("open"),
    closed: tStatus("closed"),
    down: tStatus("down"),
    maintenance: tStatus("maintenance"),
  };
  const statuses: WaitTimeStatus[] = ["open", "down", "maintenance", "closed"];
  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map((s) => (
        <span key={s}>{getStatusBadge(s, labels)}</span>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Recherche & parc au hasard                                                  */
/* -------------------------------------------------------------------------- */

export function SearchDemo() {
  const t = useTranslations("search");
  const parks = [
    "Europa-Park",
    "Disneyland Paris",
    "Walibi Belgium",
    "PortAventura",
    "Efteling",
    "Liseberg",
  ];
  const [value, setValue] = useState("");
  const [spin, setSpin] = useState(false);

  const roll = () => {
    let next = value;
    while (next === value) {
      next = parks[Math.floor(Math.random() * parks.length)];
    }
    setValue(next);
    setSpin(true);
    setTimeout(() => setSpin(false), 400);
  };

  return (
    <div className="relative rounded-4xl bg-background">
      <div className="flex h-12 items-center rounded-4xl border pl-11 pe-14 text-sm">
        <span className={value ? "font-medium" : "text-muted-foreground"}>
          {value || t("placeholder")}
        </span>
      </div>
      <SearchIcon className="absolute left-3.5 top-3.5 size-5 text-muted-foreground" />
      <button
        type="button"
        onClick={roll}
        aria-label="Random"
        className="absolute right-0 top-0 flex h-12 w-12 cursor-pointer items-center justify-center rounded-4xl border-s border-input text-primary transition-colors hover:bg-accent/50"
      >
        <Dices
          className={cn("size-5 transition-transform", spin && "rotate-180")}
        />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Spectacles — mini timeline + légende (terminé / en cours / à venir)         */
/* -------------------------------------------------------------------------- */

export function ShowsDemo() {
  const t = useTranslations("shows");
  const HOURS = [13, 14, 15, 16, 17, 18];
  const HOUR_W = 46; // px par heure
  const PX = HOUR_W / 60; // px par minute
  const START = HOURS[0];

  const mins = (h: number, m: number) => (h - START) * 60 + m;
  const nowMin = mins(15, 20);

  type Slot = { start: number; dur: number; label: string };
  const rows: { name: string; slots: Slot[] }[] = [
    {
      name: "Parade des Lumières",
      slots: [
        { start: mins(13, 30), dur: 30, label: "13:30" },
        { start: mins(16, 30), dur: 60, label: "16:30" },
      ],
    },
    {
      name: "Spectacle Aquatique",
      slots: [{ start: mins(15, 0), dur: 40, label: "15:00" }],
    },
  ];

  const slotClasses = (start: number, dur: number) => {
    const end = start + dur;
    if (end <= nowMin) return "bg-muted/50 text-muted-foreground/50"; // terminé
    if (start <= nowMin && nowMin < end)
      return "border border-dashed border-primary/30 bg-primary/10 text-primary"; // en cours
    return "border border-primary/30 bg-primary/20 text-primary"; // à venir
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <div className="flex min-w-max">
          {/* Colonne des noms */}
          <div className="w-28 shrink-0 border-e">
            <div className="h-7 border-b" />
            {rows.map((r) => (
              <div
                key={r.name}
                className="flex h-9 items-center pe-2 text-xs font-medium"
              >
                <span className="truncate">{r.name}</span>
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div
            className="relative"
            style={{ width: `${HOURS.length * HOUR_W}px` }}
          >
            {/* En-tête des heures */}
            <div className="flex h-7 border-b">
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="shrink-0 border-e border-border/50 text-center text-[10px] font-semibold text-muted-foreground"
                  style={{ width: `${HOUR_W}px` }}
                >
                  {h}:00
                </div>
              ))}
            </div>

            {/* Lignes */}
            {rows.map((r) => (
              <div key={r.name} className="relative h-9 border-b">
                {HOURS.map((h, i) => (
                  <div
                    key={h}
                    className="absolute bottom-0 top-0 border-e border-border/40"
                    style={{ left: `${i * HOUR_W}px`, width: `${HOUR_W}px` }}
                  />
                ))}
                {r.slots.map((s, i) => (
                  <div
                    key={i}
                    className={cn(
                      "absolute top-1/2 flex -translate-y-1/2 items-center rounded-sm px-1 text-[10px] font-medium",
                      slotClasses(s.start, s.dur),
                    )}
                    style={{
                      left: `${s.start * PX}px`,
                      width: `${Math.max(s.dur * PX, 20)}px`,
                      height: "18px",
                    }}
                  >
                    {s.label}
                  </div>
                ))}
              </div>
            ))}

            {/* Ligne "maintenant" */}
            <div
              className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-primary"
              style={{ left: `${nowMin * PX}px` }}
            >
              <div className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-primary" />
            </div>
          </div>
        </div>
      </div>

      {/* Légende : explique les 3 états visuels des créneaux. */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm border border-border bg-muted/50" />
          {t("legendPast")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm border border-dashed border-primary/40 bg-primary/10" />
          {t("legendOngoing")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm border border-primary/30 bg-primary/20" />
          {t("legendUpcoming")}
        </span>
      </div>
    </div>
  );
}
