import { R, CIRC, HORSESHOE_ARC, BAR_TRACK, horseshoeDash, ringDash, barWidth, clampPct } from "./gauge.js";
import { fillColour, palette, type ColourSettings } from "./theme.js";

const SIZE = 144;
const CX = SIZE / 2;
const CY = SIZE / 2;

export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "nu";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}u${m.toString().padStart(2, "0")}`;
  }
  return `${Math.round(seconds / 86400)}d`;
}

function toDataUrl(svg: string): string {
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}

export type GaugeStyle = "horseshoe" | "ring" | "bar";

export interface GaugeOpts {
  pct: number;
  countdown: string;
  showCountdown: boolean;
  background: "dark" | "light";
  colours: ColourSettings;
  style: GaugeStyle;
}

function centreText(
  text: string,
  p: { text: string; muted: string },
  countdown: string,
  showCountdown: boolean,
  yShift = 0,
): string {
  const sub =
    showCountdown && countdown
      ? `<text x="${CX}" y="${CY + 28 + yShift}" fill="${p.muted}" font-family="sans-serif" font-size="18" text-anchor="middle" dominant-baseline="middle">${countdown}</text>`
      : "";
  return `<text x="${CX}" y="${CY - 2 + yShift}" fill="${p.text}" font-family="sans-serif" font-size="36" font-weight="500" text-anchor="middle" dominant-baseline="middle">${text}</text>${sub}`;
}

export function renderGauge(o: GaugeOpts): string {
  const p = palette(o.background);
  const colour = fillColour(o.pct, o.colours);
  const pctText = `${Math.round(clampPct(o.pct))}%`;
  let track = "";
  let fill = "";

  if (o.style === "ring") {
    track = `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${p.track}" stroke-width="12"/>`;
    fill = `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${colour}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${ringDash(o.pct)} ${CIRC}" transform="rotate(-90 ${CX} ${CY})"/>`;
  } else if (o.style === "bar") {
    const x0 = (SIZE - BAR_TRACK) / 2;
    track = `<rect x="${x0}" y="${CY + 34}" width="${BAR_TRACK}" height="12" rx="6" fill="${p.track}"/>`;
    fill = `<rect x="${x0}" y="${CY + 34}" width="${barWidth(o.pct)}" height="12" rx="6" fill="${colour}"/>`;
  } else {
    const gap = CIRC - HORSESHOE_ARC;
    track = `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${p.track}" stroke-width="12" stroke-dasharray="${HORSESHOE_ARC} ${gap}" transform="rotate(135 ${CX} ${CY})"/>`;
    fill = `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${colour}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${horseshoeDash(o.pct)} ${CIRC}" transform="rotate(135 ${CX} ${CY})"/>`;
  }

  const yShift = o.style === "bar" ? -8 : 0;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="100%" height="100%" fill="${p.bg}"/>
  ${track}
  ${fill}
  ${centreText(pctText, p, o.countdown, o.showCountdown, yShift)}
</svg>`;
  return toDataUrl(svg);
}

export interface BadgeOpts {
  isPeak: boolean;
  countdown: string;
  showCountdown: boolean;
  background: "dark" | "light";
}

export function renderBadge(o: BadgeOpts): string {
  const p = palette(o.background);
  const colour = o.isPeak ? "#f85149" : "#3fb950";
  const label = o.isPeak ? "PEAK" : "OFF-PEAK";
  const sub =
    o.showCountdown && o.countdown
      ? `<text x="${CX}" y="124" fill="${p.muted}" font-family="sans-serif" font-size="18" text-anchor="middle" dominant-baseline="middle">${o.countdown}</text>`
      : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="100%" height="100%" fill="${p.bg}"/>
  <circle cx="${CX}" cy="48" r="22" fill="${colour}"/>
  <text x="${CX}" y="96" fill="${p.text}" font-family="sans-serif" font-size="${o.isPeak ? 28 : 22}" font-weight="500" text-anchor="middle" dominant-baseline="middle">${label}</text>
  ${sub}
</svg>`;
  return toDataUrl(svg);
}
