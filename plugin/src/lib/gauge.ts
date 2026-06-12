// Pure geometry for the 144x144 key. r=52 => circumference ~326.7.
// Horseshoe is a 270deg arc => 0.75 * circumference ~245.
export const R = 52;
export const CIRC = 2 * Math.PI * R;
export const HORSESHOE_ARC = CIRC * 0.75;
export const BAR_TRACK = 120;

export function clampPct(pct: number): number {
  return Math.max(0, Math.min(100, pct));
}

export function horseshoeDash(pct: number): number {
  return (clampPct(pct) / 100) * HORSESHOE_ARC;
}

export function ringDash(pct: number): number {
  return (clampPct(pct) / 100) * CIRC;
}

export function barWidth(pct: number): number {
  return (clampPct(pct) / 100) * BAR_TRACK;
}
