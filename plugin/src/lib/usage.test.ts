import { describe, it, expect } from "vitest";
import { deriveSessionState, readUsageFile, type UsageFile } from "./usage.js";

const base: UsageFile = {
  schema: 1,
  updatedAt: 1000,
  fiveHour: { usedPercentage: 40, resetsAt: 5000 },
};

describe("deriveSessionState", () => {
  it("returns setup when file is null", () => {
    expect(deriveSessionState(null, 2000).kind).toBe("setup");
  });

  it("returns ok with percentage and seconds-to-reset", () => {
    const s = deriveSessionState(base, 2000);
    expect(s.kind).toBe("ok");
    if (s.kind === "ok") {
      expect(s.percentage).toBe(40);
      expect(s.secondsToReset).toBe(3000);
    }
  });

  it("returns reset when now is past resetsAt", () => {
    expect(deriveSessionState(base, 6000).kind).toBe("reset");
  });

  it("returns stale when updatedAt older than 6h and not reset", () => {
    const old: UsageFile = {
      ...base,
      updatedAt: 0,
      fiveHour: { usedPercentage: 40, resetsAt: 999999 },
    };
    expect(deriveSessionState(old, 6 * 3600 + 1).kind).toBe("stale");
  });
});

describe("readUsageFile", () => {
  it("returns null for a missing path", () => {
    expect(readUsageFile("/no/such/usage.json")).toBeNull();
  });
});
