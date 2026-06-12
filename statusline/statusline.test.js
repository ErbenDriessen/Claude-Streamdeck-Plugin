const { test } = require("node:test");
const assert = require("node:assert");
const { buildUsageJson } = require("./statusline.js");

test("returns null when rate_limits absent (never overwrite good data)", () => {
  assert.strictEqual(buildUsageJson({ model: { display_name: "Opus" } }), null);
});

test("returns null when five_hour percentage is not a number", () => {
  assert.strictEqual(buildUsageJson({ rate_limits: { five_hour: {} } }), null);
});

test("maps five_hour and seven_day into the schema", () => {
  const out = buildUsageJson({
    rate_limits: {
      five_hour: { used_percentage: 43.2, resets_at: 1750001234 },
      seven_day: { used_percentage: 18, resets_at: 1750500000 },
    },
  });
  assert.strictEqual(out.schema, 1);
  assert.deepStrictEqual(out.fiveHour, { usedPercentage: 43.2, resetsAt: 1750001234 });
  assert.deepStrictEqual(out.sevenDay, { usedPercentage: 18, resetsAt: 1750500000 });
  assert.strictEqual(typeof out.updatedAt, "number");
});

test("includes fiveHour even if seven_day missing", () => {
  const out = buildUsageJson({
    rate_limits: { five_hour: { used_percentage: 5, resets_at: 100 } },
  });
  assert.deepStrictEqual(out.fiveHour, { usedPercentage: 5, resetsAt: 100 });
  assert.strictEqual(out.sevenDay, undefined);
});
