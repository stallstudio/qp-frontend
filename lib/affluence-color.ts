/**
 * Shared affluence colour language for the calendar and its day detail.
 *
 * The ramp is a deliberate domain convention (calm → busy, green → deep red) that
 * every crowd calendar uses, and it matches the admin ride charts so the whole
 * product speaks one visual language. Colour is never the only channel: it is
 * always doubled by the percentage and the level label, so the calendar stays
 * legible for colour-blind users.
 */

export const AFFLUENCE_RAMP = [
  "#4ade80", // green-400  — calm
  "#facc15", // yellow-400
  "#fb923c", // orange-400
  "#f87171", // red-400
  "#7f1d1d", // red-900     — packed
] as const;

export type AffluenceLevel =
  | "calm"
  | "moderate"
  | "busy"
  | "high"
  | "packed";

function parseHex(h: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function lerp(a: string, b: string, t: number): [number, number, number] {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return [
    Math.round(ar + (br - ar) * t),
    Math.round(ag + (bg - ag) * t),
    Math.round(ab + (bb - ab) * t),
  ];
}

/** RGB tuple for a rank in [0, 1], interpolated along the ramp. */
export function affluenceRgb(rank: number): [number, number, number] {
  const clamped = Math.min(Math.max(rank, 0), 1);
  const t = clamped * (AFFLUENCE_RAMP.length - 1);
  const i = Math.min(Math.floor(t), AFFLUENCE_RAMP.length - 2);
  return lerp(AFFLUENCE_RAMP[i], AFFLUENCE_RAMP[i + 1], t - i);
}

/** CSS `rgb()` for a rank, with an optional alpha in [0, 1]. */
export function affluenceCss(rank: number, alpha?: number): string {
  const [r, g, b] = affluenceRgb(rank);
  return alpha == null ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${alpha})`;
}

/** A legible ink (near-black or white) for text sitting on the ramp colour. */
export function affluenceInk(rank: number): string {
  const [r, g, b] = affluenceRgb(rank);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.58 ? "#141210" : "#ffffff";
}

/** Bucket a rank into a named level. The UI maps the key to a localized label. */
export function affluenceLevel(rank: number): AffluenceLevel {
  if (rank < 0.2) return "calm";
  if (rank < 0.4) return "moderate";
  if (rank < 0.62) return "busy";
  if (rank < 0.82) return "high";
  return "packed";
}

/** CSS gradient string for the calendar legend. */
export const AFFLUENCE_LEGEND_GRADIENT = `linear-gradient(to right, ${AFFLUENCE_RAMP.join(", ")})`;

/** Wait-time bucket colour for the day-profile bars (matches the ride charts). */
export function waitTimeColor(waitTime: number, status: string): string {
  if (
    waitTime < 0 ||
    status === "closed" ||
    status === "down" ||
    status === "maintenance"
  ) {
    return "var(--muted-foreground)";
  }
  if (waitTime <= 20) return "#22c55e";
  if (waitTime <= 40) return "#fb923c";
  return "#ef4444";
}
