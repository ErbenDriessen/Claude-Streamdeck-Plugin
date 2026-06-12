import { describe, it, expect } from "vitest";
import { fillColour, palette } from "./theme.js";

const heat = { colourMode: "heat" as const, accent: "#3fb950", warnAt: 70, dangerAt: 90 };

describe("fillColour", () => {
  it("heat: green below warn, yellow in band, red at/above danger", () => {
    expect(fillColour(10, heat)).toBe("#3fb950");
    expect(fillColour(70, heat)).toBe("#d29922");
    expect(fillColour(89, heat)).toBe("#d29922");
    expect(fillColour(90, heat)).toBe("#f85149");
  });
  it("solid: always the accent colour regardless of pct", () => {
    const solid = { colourMode: "solid" as const, accent: "#8957e5", warnAt: 70, dangerAt: 90 };
    expect(fillColour(5, solid)).toBe("#8957e5");
    expect(fillColour(95, solid)).toBe("#8957e5");
  });
});

describe("palette", () => {
  it("dark background uses dark canvas + light text", () => {
    const p = palette("dark");
    expect(p.bg).toBe("#0d1117");
    expect(p.text).toBe("#ffffff");
  });
  it("light background uses light canvas + dark text", () => {
    const p = palette("light");
    expect(p.bg).toBe("#f6f8fa");
    expect(p.text).toBe("#1f2328");
  });
});
