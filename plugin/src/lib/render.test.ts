import { describe, it, expect } from "vitest";
import { renderGauge, renderBadge, formatCountdown } from "./render.js";

const decode = (url: string) => Buffer.from(url.split(",")[1], "base64").toString("utf8");
const colours = { colourMode: "heat" as const, accent: "#3fb950", warnAt: 70, dangerAt: 90 };
const opts = { pct: 42, countdown: "2u14", showCountdown: true, background: "dark" as const, bgColor: "#0d1117", colours };

describe("formatCountdown", () => {
  it("formats minutes, hours+minutes, days, and zero", () => {
    expect(formatCountdown(3000)).toBe("50m");
    expect(formatCountdown(3600 + 14 * 60)).toBe("1u14");
    expect(formatCountdown(2 * 86400)).toBe("2d");
    expect(formatCountdown(0)).toBe("nu");
  });
});

describe("renderGauge", () => {
  it("horseshoe: data url, shows pct, uses rotate(135) and dasharray", () => {
    const url = renderGauge({ ...opts, style: "horseshoe" });
    expect(url.startsWith("data:image/svg+xml;base64,")).toBe(true);
    const svg = decode(url);
    expect(svg).toContain("42%");
    expect(svg).toContain("rotate(135");
    expect(svg).toContain("2u14");
  });
  it("ring: rotates -90 (12 o'clock start)", () => {
    expect(decode(renderGauge({ ...opts, style: "ring" }))).toContain("rotate(-90");
  });
  it("bar: contains a rect-based fill", () => {
    expect(decode(renderGauge({ ...opts, style: "bar" }))).toContain("<rect");
  });
  it("hides countdown when showCountdown is false", () => {
    const svg = decode(renderGauge({ ...opts, style: "horseshoe", showCountdown: false }));
    expect(svg).not.toContain("2u14");
  });
  it("unknown style falls back to horseshoe (rotate 135)", () => {
    // @ts-expect-error intentional bad value
    expect(decode(renderGauge({ ...opts, style: "bogus" }))).toContain("rotate(135");
  });
  it("background rect fills the full 144 canvas in absolute units (Stream Deck mis-scales 100%)", () => {
    const svg = decode(renderGauge({ ...opts, style: "horseshoe" }));
    expect(svg).toContain('width="144" height="144"');
    expect(svg).not.toContain("100%");
  });
  it("transparent background draws no <rect>", () => {
    const svg = decode(renderGauge({ ...opts, style: "horseshoe", background: "transparent" }));
    expect(svg).not.toContain("<rect");
  });
  it("custom background uses the chosen colour as the rect fill", () => {
    const svg = decode(renderGauge({ ...opts, style: "horseshoe", background: "custom", bgColor: "#123456" }));
    expect(svg).toContain('fill="#123456"');
  });
});

describe("renderBadge", () => {
  it("shows PEAK and the countdown", () => {
    const svg = decode(renderBadge({ isPeak: true, countdown: "1u00", showCountdown: true, background: "dark", bgColor: "#0d1117" }));
    expect(svg).toContain("PEAK");
    expect(svg).toContain("1u00");
  });
  it("shows OFF-PEAK when off-peak", () => {
    expect(decode(renderBadge({ isPeak: false, countdown: "3u00", showCountdown: true, background: "dark", bgColor: "#0d1117" }))).toContain("OFF-PEAK");
  });
});
