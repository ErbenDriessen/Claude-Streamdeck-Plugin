import { deriveSessionState, type UsageFile } from "./usage.js";
import type { UsageSnapshot } from "./usageApi.js";

export type Window = "fiveHour" | "sevenDay";

export type SessionReading =
  | { kind: "official"; pct: number; secondsToReset: number }
  | { kind: "setup" };

/**
 * Priority: live API snapshot -> fresh usage.json (status line) -> setup.
 * Both real sources are "official"; we never fabricate a number.
 */
export function resolveSessionReading(
  snapshot: UsageSnapshot | null,
  file: UsageFile | null,
  nowS: number,
  window: Window,
): SessionReading {
  if (snapshot) {
    const w = window === "sevenDay" ? snapshot.sevenDay : snapshot.fiveHour;
    if (w) {
      return { kind: "official", pct: w.utilization, secondsToReset: Math.max(0, Math.round(w.resetsAtMs / 1000 - nowS)) };
    }
  }

  const state = deriveSessionState(file, nowS);
  if (state.kind === "ok" && file) {
    const win = window === "sevenDay" && file.sevenDay ? file.sevenDay : file.fiveHour;
    return { kind: "official", pct: win.usedPercentage, secondsToReset: Math.max(0, win.resetsAt - nowS) };
  }

  return { kind: "setup" };
}
