import { describe, it, expect } from "vitest";
import { CIRC, horseshoeDash, ringDash, barWidth, clampPct } from "./gauge.js";

describe("gauge geometry", () => {
  it("clampPct bounds to 0..100", () => {
    expect(clampPct(-5)).toBe(0);
    expect(clampPct(150)).toBe(100);
    expect(clampPct(42)).toBe(42);
  });
  it("horseshoe fill is pct of the 270deg arc (245 of circumference)", () => {
    expect(horseshoeDash(0)).toBeCloseTo(0, 3);
    expect(horseshoeDash(100)).toBeCloseTo(245, 0);
    expect(horseshoeDash(20)).toBeCloseTo(49, 0);
  });
  it("ring fill is pct of full circumference", () => {
    expect(ringDash(100)).toBeCloseTo(CIRC, 0);
    expect(ringDash(50)).toBeCloseTo(CIRC / 2, 0);
  });
  it("bar width is pct of the inner track width (120px)", () => {
    expect(barWidth(0)).toBe(0);
    expect(barWidth(100)).toBe(120);
    expect(barWidth(50)).toBe(60);
  });
});
