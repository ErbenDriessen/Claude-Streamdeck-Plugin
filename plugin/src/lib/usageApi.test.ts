import { describe, it, expect } from "vitest";
import { parseUsageResponse } from "./usageApi.js";

describe("parseUsageResponse", () => {
  it("parses five_hour and seven_day utilization + reset", () => {
    const body = JSON.stringify({
      five_hour: { utilization: 37.0, resets_at: "2026-06-12T19:59:59.4+00:00" },
      seven_day: { utilization: 21.0, resets_at: "2026-06-13T16:59:59.4+00:00" },
      seven_day_sonnet: { utilization: 0.0, resets_at: "2026-06-13T17:00:00.4+00:00" },
    });
    const snap = parseUsageResponse(body);
    expect(snap?.fiveHour?.utilization).toBe(37);
    expect(snap?.fiveHour?.resetsAtMs).toBe(Date.parse("2026-06-12T19:59:59.4+00:00"));
    expect(snap?.sevenDay?.utilization).toBe(21);
  });
  it("keeps a window null when its data is missing", () => {
    const snap = parseUsageResponse(JSON.stringify({ five_hour: { utilization: 5, resets_at: "2026-06-12T10:00:00Z" } }));
    expect(snap?.fiveHour?.utilization).toBe(5);
    expect(snap?.sevenDay).toBeNull();
  });
  it("returns null when neither window is present", () => {
    expect(parseUsageResponse(JSON.stringify({ extra_usage: {} }))).toBeNull();
  });
  it("returns null on malformed json", () => {
    expect(parseUsageResponse("nope")).toBeNull();
  });
});
