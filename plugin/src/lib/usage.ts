import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface UsageFile {
  schema: number;
  updatedAt: number; // epoch seconds
  fiveHour: { usedPercentage: number; resetsAt: number };
  sevenDay?: { usedPercentage: number; resetsAt: number };
}

export type SessionState =
  | { kind: "setup" }
  | { kind: "reset" }
  | { kind: "stale" }
  | { kind: "ok"; percentage: number; secondsToReset: number };

const STALE_AFTER_S = 6 * 3600;

/** Pure state machine: turns a usage file + current time into a render state. */
export function deriveSessionState(file: UsageFile | null, nowS: number): SessionState {
  if (!file || !file.fiveHour) return { kind: "setup" };
  const { usedPercentage, resetsAt } = file.fiveHour;
  if (nowS >= resetsAt) return { kind: "reset" };
  if (nowS - file.updatedAt > STALE_AFTER_S) return { kind: "stale" };
  return { kind: "ok", percentage: usedPercentage, secondsToReset: resetsAt - nowS };
}

export function usageFilePath(): string {
  return join(homedir(), ".claude", "usage.json");
}

/** Reads + parses usage.json. Returns null on any error (missing/corrupt). */
export function readUsageFile(path = usageFilePath()): UsageFile | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as UsageFile;
  } catch {
    return null;
  }
}
