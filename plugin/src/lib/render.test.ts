import { describe, it, expect } from "vitest";
import { heatColor, formatCountdown, renderRingSvg, renderBadgeSvg } from "./render.js";

const decode = (url: string) => Buffer.from(url.split(",")[1], "base64").toString("utf8");

describe("heatColor", () => {
  it("green<70, yellow 70–89, red>=90", () => {
    expect(heatColor(10)).toBe("#3fb950");
    expect(heatColor(75)).toBe("#d29922");
    expect(heatColor(95)).toBe("#f85149");
  });
});

describe("formatCountdown", () => {
  it("formats minutes, hours+minutes, days, and zero", () => {
    expect(formatCountdown(3000)).toBe("50m");
    expect(formatCountdown(3600 + 14 * 60)).toBe("1u14");
    expect(formatCountdown(2 * 86400)).toBe("2d");
    expect(formatCountdown(0)).toBe("nu");
  });
});

describe("renderRingSvg", () => {
  it("returns an svg data URL containing the percentage and countdown", () => {
    const url = renderRingSvg(42, "2u14");
    expect(url.startsWith("data:image/svg+xml;base64,")).toBe(true);
    const svg = decode(url);
    expect(svg).toContain("42%");
    expect(svg).toContain("2u14");
  });
});

describe("renderBadgeSvg", () => {
  it("shows PEAK when peak", () => {
    expect(decode(renderBadgeSvg(true, "1u00"))).toContain("PEAK");
  });
  it("shows OFF-PEAK when off-peak", () => {
    expect(decode(renderBadgeSvg(false, "3u00"))).toContain("OFF-PEAK");
  });
});
