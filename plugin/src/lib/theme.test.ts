import { describe, it, expect } from "vitest";
import { fillColour, resolvePalette, relativeLuminance } from "./theme.js";

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

describe("relativeLuminance", () => {
  it("is high for white, low for black", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 2);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 2);
  });
});

describe("resolvePalette", () => {
  it("dark uses dark canvas + light text", () => {
    const p = resolvePalette("dark", "#000000");
    expect(p.bg).toBe("#0d1117");
    expect(p.text).toBe("#ffffff");
  });
  it("light uses light canvas + dark text", () => {
    const p = resolvePalette("light", "#000000");
    expect(p.bg).toBe("#f6f8fa");
    expect(p.text).toBe("#1f2328");
  });
  it("transparent draws no background (bg null) with light text", () => {
    const p = resolvePalette("transparent", "#000000");
    expect(p.bg).toBeNull();
    expect(p.text).toBe("#ffffff");
  });
  it("custom dark colour -> white text", () => {
    const p = resolvePalette("custom", "#102030");
    expect(p.bg).toBe("#102030");
    expect(p.text).toBe("#ffffff");
  });
  it("custom light colour -> dark text", () => {
    const p = resolvePalette("custom", "#eeddcc");
    expect(p.bg).toBe("#eeddcc");
    expect(p.text).toBe("#1f2328");
  });
});
