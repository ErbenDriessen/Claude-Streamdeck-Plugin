import { describe, it, expect } from "vitest";
import { resolveSessionReading } from "./source.js";
import type { UsageFile } from "./usage.js";
import type { UsageSnapshot } from "./usageApi.js";

const snap: UsageSnapshot = {
  fiveHour: { utilization: 37, resetsAtMs: 5000 * 1000 },
  sevenDay: { utilization: 21, resetsAtMs: 9000 * 1000 },
};
const file: UsageFile = { schema: 1, updatedAt: 1000, fiveHour: { usedPercentage: 12, resetsAt: 4000 } };

describe("resolveSessionReading", () => {
  it("prefers the live API snapshot (five-hour)", () => {
    expect(resolveSessionReading(snap, file, 2000, "fiveHour")).toEqual({ kind: "official", pct: 37, secondsToReset: 3000 });
  });
  it("uses the seven-day window from the snapshot when chosen", () => {
    expect(resolveSessionReading(snap, file, 2000, "sevenDay")).toEqual({ kind: "official", pct: 21, secondsToReset: 7000 });
  });
  it("falls back to fresh usage.json when no snapshot", () => {
    expect(resolveSessionReading(null, file, 2000, "fiveHour")).toEqual({ kind: "official", pct: 12, secondsToReset: 2000 });
  });
  it("returns setup when neither source is available", () => {
    expect(resolveSessionReading(null, null, 2000, "fiveHour").kind).toBe("setup");
  });
});
