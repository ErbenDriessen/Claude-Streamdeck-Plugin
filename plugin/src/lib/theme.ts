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

export interface Palette {
  bg: string;
  text: string;
  track: string;
  muted: string;
}

export function palette(background: "dark" | "light"): Palette {
  return background === "light"
    ? { bg: "#f6f8fa", text: "#1f2328", track: "#d0d7de", muted: "#6e7781" }
    : { bg: "#0d1117", text: "#ffffff", track: "#21262d", muted: "#8b949e" };
}
