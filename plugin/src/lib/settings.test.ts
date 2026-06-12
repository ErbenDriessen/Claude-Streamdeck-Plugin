import { describe, it, expect } from "vitest";
import { withSessionDefaults, withPeakDefaults, SESSION_DEFAULTS, PEAK_DEFAULTS } from "./settings.js";

describe("settings defaults + merge", () => {
  it("fills missing session fields with defaults", () => {
    expect(withSessionDefaults({})).toEqual(SESSION_DEFAULTS);
  });
  it("keeps provided session overrides", () => {
    expect(withSessionDefaults({ gaugeStyle: "bar", warnAt: 60 })).toMatchObject({ gaugeStyle: "bar", warnAt: 60, window: "fiveHour" });
  });
  it("fills missing peak fields with defaults", () => {
    expect(withPeakDefaults({})).toEqual(PEAK_DEFAULTS);
  });
  it("keeps provided peak overrides", () => {
    expect(withPeakDefaults({ peakStartUTC: 12 }).peakStartUTC).toBe(12);
  });
});
