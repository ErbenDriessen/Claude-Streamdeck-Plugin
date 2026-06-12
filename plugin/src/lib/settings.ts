import type { Background } from "./theme.js";

export interface SessionSettings {
  window: "fiveHour" | "sevenDay";
  showCountdown: boolean;
  gaugeStyle: "horseshoe" | "ring" | "bar";
  colourMode: "heat" | "solid";
  accent: string;
  background: Background;
  bgColor: string;
  warnAt: number;
  dangerAt: number;
}

export interface PeakSettings {
  showCountdown: boolean;
  background: Background;
  bgColor: string;
  peakStartUTC: number;
  peakEndUTC: number;
}

export const SESSION_DEFAULTS: SessionSettings = {
  window: "fiveHour",
  showCountdown: true,
  gaugeStyle: "horseshoe",
  colourMode: "heat",
  accent: "#3fb950",
  background: "dark",
  bgColor: "#1d9e75",
  warnAt: 70,
  dangerAt: 90,
};

export const PEAK_DEFAULTS: PeakSettings = {
  showCountdown: true,
  background: "dark",
  bgColor: "#1d9e75",
  peakStartUTC: 13,
  peakEndUTC: 19,
};

export function withSessionDefaults(s: Partial<SessionSettings>): SessionSettings {
  return { ...SESSION_DEFAULTS, ...s };
}

export function withPeakDefaults(s: Partial<PeakSettings>): PeakSettings {
  return { ...PEAK_DEFAULTS, ...s };
}
