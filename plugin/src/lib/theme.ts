export interface ColourSettings {
  colourMode: "heat" | "solid";
  accent: string;
  warnAt: number;
  dangerAt: number;
}

export function fillColour(pct: number, s: ColourSettings): string {
  if (s.colourMode === "solid") return s.accent;
  if (pct >= s.dangerAt) return "#f85149";
  if (pct >= s.warnAt) return "#d29922";
  return "#3fb950";
}

export type Background = "dark" | "light" | "transparent" | "custom";

export interface Palette {
  bg: string | null; // null => draw no background rect (transparent)
  text: string;
  track: string;
  muted: string;
}

const DARK: Palette = { bg: "#0d1117", text: "#ffffff", track: "#21262d", muted: "#8b949e" };
const LIGHT: Palette = { bg: "#f6f8fa", text: "#1f2328", track: "#d0d7de", muted: "#6e7781" };

/** Perceived luminance 0..1 of a #rgb / #rrggbb colour. */
export function relativeLuminance(hex: string): number {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Resolve the drawing palette from the chosen background mode + custom colour. */
export function resolvePalette(background: Background, bgColor: string): Palette {
  if (background === "light") return LIGHT;
  if (background === "transparent") return { ...DARK, bg: null };
  if (background === "custom") {
    return relativeLuminance(bgColor) < 0.5
      ? { bg: bgColor, text: "#ffffff", track: "#ffffff33", muted: "#ffffffb3" }
      : { bg: bgColor, text: "#1f2328", track: "#00000026", muted: "#00000099" };
  }
  return DARK;
}
