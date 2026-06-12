import { describe, it, expect } from "vitest";
import { derivePeakState, PEAK_SCHEDULE } from "./peak.js";

// 2026-06-15 is a Monday; 2026-06-13 is a Saturday.
const mondayUTC = (h: number, m = 0) => Date.UTC(2026, 5, 15, h, m) / 1000;
const fridayUTC = (h: number) => Date.UTC(2026, 5, 19, h) / 1000;
const saturdayUTC = (h: number) => Date.UTC(2026, 5, 13, h) / 1000;

describe("derivePeakState", () => {
  it("is off-peak on weekends", () => {
    expect(derivePeakState(saturdayUTC(15)).isPeak).toBe(false);
  });

  it("is peak Monday 13:00–19:00 UTC", () => {
    expect(derivePeakState(mondayUTC(13)).isPeak).toBe(true);
    expect(derivePeakState(mondayUTC(18, 59)).isPeak).toBe(true);
  });

  it("is off-peak Monday before 13:00 and at/after 19:00 UTC", () => {
    expect(derivePeakState(mondayUTC(12, 59)).isPeak).toBe(false);
    expect(derivePeakState(mondayUTC(19)).isPeak).toBe(false);
  });

  it("counts seconds down to the next switch (off-peak -> peak)", () => {
    expect(derivePeakState(mondayUTC(12)).secondsToSwitch).toBe(3600);
  });

  it("counts seconds down to the next switch (peak -> off-peak)", () => {
    expect(derivePeakState(mondayUTC(18)).secondsToSwitch).toBe(3600);
  });

  it("handles the long weekend gap (Fri 19:00 -> Mon 13:00)", () => {
    const s = derivePeakState(fridayUTC(19));
    expect(s.isPeak).toBe(false);
    // 2 full weekend days (Sat+Sun) + 13h Monday morning = 61h
    expect(s.secondsToSwitch).toBe((2 * 24 + 13 + 5) * 3600);
  });

  it("exposes the schedule as editable data", () => {
    expect(PEAK_SCHEDULE).toEqual({ startHourUTC: 13, endHourUTC: 19, weekdays: [1, 2, 3, 4, 5] });
  });
});
