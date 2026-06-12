# Claude Stream Deck Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Elgato Stream Deck plugin with two same-styled actions — a Claude session-limit ring (% used + reset countdown) and a peak-hour ticker (PEAK/OFF-PEAK + countdown).

**Architecture:** The global Claude Code status line script persists the official 5h rate-limit numbers to `~/.claude/usage.json`. A custom Stream Deck plugin (Elgato SDK, TypeScript) polls that file for the session-limit action and derives peak status client-side from a fixed weekday 13:00–19:00 UTC schedule for the peak action. Pure logic lives in tested `lib/` modules; SDK glue is thin.

**Tech Stack:** Node.js (producer: plain JS + `node:test`; plugin: TypeScript + Vitest + `@elgato/streamdeck` SDK), SVG rendering.

---

## File Structure

```
statusline/
  statusline.js              # self-contained status line: renders line + writes usage.json; exports buildUsageJson
  statusline.test.js         # node:test unit tests for buildUsageJson
plugin/
  package.json               # plugin deps + scripts (vitest, tsc, @elgato/streamdeck)
  tsconfig.json
  vitest.config.ts
  src/
    lib/usage.ts             # read usage.json + state machine (pure)
    lib/usage.test.ts
    lib/peak.ts              # peak schedule + next-switch math (pure)
    lib/peak.test.ts
    lib/render.ts            # shared SVG ring/badge renderer (pure)
    lib/render.test.ts
    actions/session-limit.ts # SDK glue: poll usage -> render
    actions/peak-ticker.ts   # SDK glue: derive peak -> render
    plugin.ts                # registers both actions
  <uuid>.sdPlugin/manifest.json   # created by `streamdeck create`, edited for 2 actions
docs/superpowers/...         # spec + this plan
```

**Phase boundaries:** Tasks 1–6 need only Node 22 and run/test immediately. Tasks 7–11 require the prerequisites (Node 24+, Stream Deck app 7.1+) and a physical/virtual Stream Deck for manual verification.

---

## Task 1: Producer — `buildUsageJson` (pure, TDD)

**Files:**
- Create: `statusline/statusline.test.js`
- Create: `statusline/statusline.js` (port of the live `~/.claude/statusline.js`, refactored to export `buildUsageJson` and write the file)

- [ ] **Step 1: Write the failing test**

```javascript
// statusline/statusline.test.js
const { test } = require("node:test");
const assert = require("node:assert");
const { buildUsageJson } = require("./statusline.js");

test("returns null when rate_limits absent (never overwrite good data)", () => {
  assert.strictEqual(buildUsageJson({ model: { display_name: "Opus" } }), null);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test statusline/statusline.test.js`
Expected: FAIL — `Cannot find module './statusline.js'`.

- [ ] **Step 3: Write minimal implementation**

```javascript
// statusline/statusline.js
// Claude Code status line: renders the line AND persists official rate-limit
// numbers to ~/.claude/usage.json for the Stream Deck plugin.
const fs = require("fs");
const os = require("os");
const path = require("path");

function buildUsageJson(d) {
  const rl = d && d.rate_limits;
  if (!rl || !rl.five_hour || typeof rl.five_hour.used_percentage !== "number") {
    return null; // no real numbers -> caller must not overwrite last good file
  }
  const out = {
    schema: 1,
    updatedAt: Math.floor(nowMs() / 1000),
    fiveHour: {
      usedPercentage: rl.five_hour.used_percentage,
      resetsAt: rl.five_hour.resets_at,
    },
  };
  if (rl.seven_day && typeof rl.seven_day.used_percentage === "number") {
    out.sevenDay = {
      usedPercentage: rl.seven_day.used_percentage,
      resetsAt: rl.seven_day.resets_at,
    };
  }
  return out;
}

// Wrapped so tests can stub if ever needed; Date is allowed at runtime here.
function nowMs() {
  return Date.now();
}

function writeUsageJson(d) {
  try {
    const payload = buildUsageJson(d);
    if (!payload) return; // preserve last known good
    const file = path.join(os.homedir(), ".claude", "usage.json");
    fs.writeFileSync(file, JSON.stringify(payload));
  } catch {
    // never break the status line because of a write error
  }
}

module.exports = { buildUsageJson, writeUsageJson };

if (require.main === module) {
  runStatusLine();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test statusline/statusline.test.js`
Expected: 3 tests pass. (`runStatusLine` is referenced but only called when run directly; the require for tests does not invoke it.)

- [ ] **Step 5: Commit**

```bash
git add statusline/statusline.js statusline/statusline.test.js
git commit -m "Add tested buildUsageJson for status line usage export"
```

---

## Task 2: Producer — render + write integration, then install live

**Files:**
- Modify: `statusline/statusline.js` (add `runStatusLine` that renders the existing line AND calls `writeUsageJson`)

- [ ] **Step 1: Add `runStatusLine` (render unchanged from the live script + write)**

Append to `statusline/statusline.js` (before the `if (require.main...)` block):

```javascript
function runStatusLine() {
  let raw = "";
  process.stdin.on("data", (c) => (raw += c));
  process.stdin.on("end", () => {
    let d = {};
    try { d = JSON.parse(raw || "{}"); } catch {}

    writeUsageJson(d); // <-- new: persist for the Stream Deck plugin

    const c = { reset:"\x1b[0m", dim:"\x1b[2m", cyan:"\x1b[36m", green:"\x1b[32m",
                yellow:"\x1b[33m", red:"\x1b[31m", gray:"\x1b[90m" };
    const heat = (p) => (p >= 90 ? c.red : p >= 70 ? c.yellow : c.green);
    const bar = (p) => {
      const f = Math.round((Math.max(0, Math.min(100, p)) / 100) * 10);
      return "█".repeat(f) + "░".repeat(10 - f);
    };
    const parts = [];
    const model = d?.model?.display_name;
    if (model) parts.push(`${c.cyan}${model}${c.reset}`);
    const fiveH = d?.rate_limits?.five_hour?.used_percentage;
    if (typeof fiveH === "number") parts.push(`${heat(fiveH)}5u ${bar(fiveH)} ${fiveH.toFixed(0)}%${c.reset}`);
    const sevenD = d?.rate_limits?.seven_day?.used_percentage;
    if (typeof sevenD === "number") parts.push(`${c.dim}7d ${sevenD.toFixed(0)}%${c.reset}`);
    const ctx = d?.context_window?.used_percentage;
    if (typeof ctx === "number") parts.push(`${c.gray}ctx${c.reset} ${heat(ctx)}${ctx.toFixed(0)}%${c.reset}`);
    if (typeof fiveH !== "number") parts.push(`${c.gray}limiet: wacht op 1e reactie${c.reset}`);
    process.stdout.write(parts.join(`${c.gray} · ${c.reset}`));
  });
}
```

- [ ] **Step 2: Manually verify render + write with sample input**

Run (bash):
```bash
echo '{"model":{"display_name":"Opus 4.8"},"rate_limits":{"five_hour":{"used_percentage":42.5,"resets_at":1750001234},"seven_day":{"used_percentage":18,"resets_at":1750500000}}}' | node statusline/statusline.js
```
Expected: the coloured status line prints AND `~/.claude/usage.json` now exists. Verify:
```bash
cat ~/.claude/usage.json
```
Expected: `{"schema":1,"updatedAt":<epoch>,"fiveHour":{"usedPercentage":42.5,"resetsAt":1750001234},"sevenDay":{"usedPercentage":18,"resetsAt":1750500000}}`

- [ ] **Step 3: Verify "no rate_limits" does NOT overwrite**

```bash
echo '{"model":{"display_name":"Opus"},"context_window":{"used_percentage":12}}' | node statusline/statusline.js
cat ~/.claude/usage.json
```
Expected: status line prints `limiet: wacht...`; `usage.json` still shows the previous values (unchanged).

- [ ] **Step 4: Install the repo version as the live global status line**

```bash
cp statusline/statusline.js ~/.claude/statusline.js
```
Expected: no error. The live status line now also writes `usage.json` on every refresh.

- [ ] **Step 5: Commit**

```bash
git add statusline/statusline.js
git commit -m "Status line renders line and writes usage.json; install live"
```

---

## Task 3: Plugin — scaffold tooling (TS + Vitest)

**Files:**
- Create: `plugin/package.json`
- Create: `plugin/tsconfig.json`
- Create: `plugin/vitest.config.ts`

- [ ] **Step 1: Create `plugin/package.json`**

```json
{
  "name": "claude-streamdeck-plugin",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "tsc -p tsconfig.json"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  },
  "dependencies": {
    "@elgato/streamdeck": "^1.0.0"
  }
}
```

- [ ] **Step 2: Create `plugin/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "es2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `plugin/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["src/**/*.test.ts"] } });
```

- [ ] **Step 4: Install dev deps (pure-logic tooling only; works on Node 22)**

Run (bash, from `plugin/`):
```bash
npm install
```
Expected: installs typescript + vitest (+ @elgato/streamdeck). No build yet.

- [ ] **Step 5: Commit**

```bash
git add plugin/package.json plugin/tsconfig.json plugin/vitest.config.ts plugin/package-lock.json
git commit -m "Scaffold plugin TypeScript + Vitest tooling"
```

---

## Task 4: Plugin — `lib/usage.ts` read + state machine (TDD)

**Files:**
- Create: `plugin/src/lib/usage.test.ts`
- Create: `plugin/src/lib/usage.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// plugin/src/lib/usage.ts is imported here
import { describe, it, expect } from "vitest";
import { deriveSessionState } from "./usage.js";

const base = { schema: 1, updatedAt: 1000, fiveHour: { usedPercentage: 40, resetsAt: 5000 } };

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
    const old = { ...base, updatedAt: 0, fiveHour: { usedPercentage: 40, resetsAt: 999999 } };
    expect(deriveSessionState(old, 6 * 3600 + 1).kind).toBe("stale");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `plugin/`): `npm test`
Expected: FAIL — cannot resolve `./usage.js`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// plugin/src/lib/usage.ts
export interface UsageFile {
  schema: number;
  updatedAt: number; // epoch seconds
  fiveHour: { usedPercentage: number; resetsAt: number };
  sevenDay?: { usedPercentage: number; resetsAt: number };
}

export type SessionState =
  | { kind: "setup" }
  | { kind: "reset" }
  | { kind: "stale" }
  | { kind: "ok"; percentage: number; secondsToReset: number };

const STALE_AFTER_S = 6 * 3600;

export function deriveSessionState(file: UsageFile | null, nowS: number): SessionState {
  if (!file || !file.fiveHour) return { kind: "setup" };
  const { usedPercentage, resetsAt } = file.fiveHour;
  if (nowS >= resetsAt) return { kind: "reset" };
  if (nowS - file.updatedAt > STALE_AFTER_S) return { kind: "stale" };
  return { kind: "ok", percentage: usedPercentage, secondsToReset: resetsAt - nowS };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: 4 tests pass.

- [ ] **Step 5: Add and test the file reader**

Append to `plugin/src/lib/usage.ts`:

```typescript
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function usageFilePath(): string {
  return join(homedir(), ".claude", "usage.json");
}

/** Reads + parses usage.json. Returns null on any error (missing/corrupt). */
export function readUsageFile(path = usageFilePath()): UsageFile | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as UsageFile;
  } catch {
    return null;
  }
}
```

Add to `plugin/src/lib/usage.test.ts`:

```typescript
import { readUsageFile } from "./usage.js";
it("readUsageFile returns null for a missing path", () => {
  expect(readUsageFile("/no/such/usage.json")).toBeNull();
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`
Expected: 5 tests pass.

- [ ] **Step 7: Commit**

```bash
git add plugin/src/lib/usage.ts plugin/src/lib/usage.test.ts
git commit -m "Add usage.json reader and session state machine"
```

---

## Task 5: Plugin — `lib/peak.ts` schedule + next switch (TDD)

**Files:**
- Create: `plugin/src/lib/peak.test.ts`
- Create: `plugin/src/lib/peak.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { derivePeakState, PEAK_SCHEDULE } from "./peak.js";

// helper: build an epoch-seconds value for a given UTC weekday/hour
// 2026-06-15 is a Monday.
const mondayUTC = (h: number, m = 0) => Date.UTC(2026, 5, 15, h, m) / 1000;
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
  it("exposes the schedule as editable data", () => {
    expect(PEAK_SCHEDULE).toEqual({ startHourUTC: 13, endHourUTC: 19, weekdays: [1, 2, 3, 4, 5] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./peak.js`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// plugin/src/lib/peak.ts
// Anthropic peak window (in effect since 2026-03-27): weekdays 13:00–19:00 UTC.
// Fixed schedule — edit here if Anthropic ever changes it.
export const PEAK_SCHEDULE = {
  startHourUTC: 13,
  endHourUTC: 19,
  weekdays: [1, 2, 3, 4, 5], // 0=Sun .. 6=Sat
} as const;

export interface PeakState {
  isPeak: boolean;
  secondsToSwitch: number;
}

const DAY = 86400;
const HOUR = 3600;

export function derivePeakState(nowS: number, schedule = PEAK_SCHEDULE): PeakState {
  const d = new Date(nowS * 1000);
  const dow = d.getUTCDay();
  const secOfDay = d.getUTCHours() * HOUR + d.getUTCMinutes() * 60 + d.getUTCSeconds();
  const start = schedule.startHourUTC * HOUR;
  const end = schedule.endHourUTC * HOUR;
  const isWeekday = schedule.weekdays.includes(dow);
  const isPeak = isWeekday && secOfDay >= start && secOfDay < end;

  // Scan forward second-boundaries to the next transition (max ~3 days ahead).
  let t = nowS;
  for (let i = 0; i < 4 * DAY; ) {
    // jump to the next candidate boundary instead of stepping by 1s
    const cur = peakAt(t, schedule);
    const next = nextBoundary(t, schedule);
    if (peakAt(next, schedule) !== cur) return { isPeak, secondsToSwitch: next - nowS };
    i += next - t;
    t = next;
  }
  return { isPeak, secondsToSwitch: 0 };
}

function peakAt(nowS: number, s: typeof PEAK_SCHEDULE): boolean {
  const d = new Date(nowS * 1000);
  const secOfDay = d.getUTCHours() * HOUR + d.getUTCMinutes() * 60 + d.getUTCSeconds();
  return s.weekdays.includes(d.getUTCDay()) && secOfDay >= s.startHourUTC * HOUR && secOfDay < s.endHourUTC * HOUR;
}

/** Next start- or end-of-window boundary strictly after nowS. */
function nextBoundary(nowS: number, s: typeof PEAK_SCHEDULE): number {
  const d = new Date(nowS * 1000);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000;
  const candidates = [midnight + s.startHourUTC * HOUR, midnight + s.endHourUTC * HOUR, midnight + DAY];
  for (const c of candidates) if (c > nowS) return c;
  return nowS + DAY;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: all peak tests pass (6).

- [ ] **Step 5: Commit**

```bash
git add plugin/src/lib/peak.ts plugin/src/lib/peak.test.ts
git commit -m "Add client-side peak schedule and next-switch math"
```

---

## Task 6: Plugin — `lib/render.ts` shared SVG (TDD)

**Files:**
- Create: `plugin/src/lib/render.test.ts`
- Create: `plugin/src/lib/render.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { heatColor, formatCountdown, renderRingSvg, renderBadgeSvg } from "./render.js";

describe("render helpers", () => {
  it("heatColor: green<70, yellow 70–89, red>=90", () => {
    expect(heatColor(10)).toBe("#3fb950");
    expect(heatColor(75)).toBe("#d29922");
    expect(heatColor(95)).toBe("#f85149");
  });
  it("formatCountdown: H+M under a day, else days", () => {
    expect(formatCountdown(3000)).toBe("50m");
    expect(formatCountdown(3600 + 14 * 60)).toBe("1u14");
    expect(formatCountdown(2 * 86400)).toBe("2d");
    expect(formatCountdown(0)).toBe("nu");
  });
  it("renderRingSvg returns an svg data URL containing the percentage", () => {
    const url = renderRingSvg(42, "2u14");
    expect(url.startsWith("data:image/svg+xml;base64,")).toBe(true);
    const svg = Buffer.from(url.split(",")[1], "base64").toString("utf8");
    expect(svg).toContain("42%");
    expect(svg).toContain("2u14");
  });
  it("renderBadgeSvg shows PEAK/OFF-PEAK label", () => {
    const svg = Buffer.from(renderBadgeSvg(true, "1u00").split(",")[1], "base64").toString("utf8");
    expect(svg).toContain("PEAK");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./render.js`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// plugin/src/lib/render.ts
// Shared SVG rendering so both actions look identical. 144x144 (Stream Deck key @2x).
const SIZE = 144;

export function heatColor(pct: number): string {
  if (pct >= 90) return "#f85149";
  if (pct >= 70) return "#d29922";
  return "#3fb950";
}

export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "nu";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}u${m.toString().padStart(2, "0")}`;
  }
  return `${Math.round(seconds / 86400)}d`;
}

function toDataUrl(svg: string): string {
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}

export function renderRingSvg(pct: number, countdown: string): string {
  const r = 56, cx = SIZE / 2, cy = SIZE / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * circ;
  const color = heatColor(pct);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="100%" height="100%" fill="#0d1117"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#21262d" stroke-width="12"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="12"
    stroke-linecap="round" stroke-dasharray="${dash} ${circ}" transform="rotate(-90 ${cx} ${cy})"/>
  <text x="${cx}" y="${cy - 2}" fill="#fff" font-family="sans-serif" font-size="38" font-weight="700"
    text-anchor="middle" dominant-baseline="middle">${Math.round(pct)}%</text>
  <text x="${cx}" y="${cy + 30}" fill="#8b949e" font-family="sans-serif" font-size="20"
    text-anchor="middle" dominant-baseline="middle">${countdown}</text>
</svg>`;
  return toDataUrl(svg);
}

export function renderBadgeSvg(isPeak: boolean, countdown: string): string {
  const color = isPeak ? "#f85149" : "#3fb950";
  const label = isPeak ? "PEAK" : "OFF-PEAK";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="100%" height="100%" fill="#0d1117"/>
  <circle cx="${SIZE / 2}" cy="48" r="22" fill="${color}"/>
  <text x="${SIZE / 2}" y="96" fill="#fff" font-family="sans-serif" font-size="${isPeak ? 28 : 22}" font-weight="700"
    text-anchor="middle" dominant-baseline="middle">${label}</text>
  <text x="${SIZE / 2}" y="124" fill="#8b949e" font-family="sans-serif" font-size="18"
    text-anchor="middle" dominant-baseline="middle">${countdown}</text>
</svg>`;
  return toDataUrl(svg);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: all render tests pass (4).

- [ ] **Step 5: Commit**

```bash
git add plugin/src/lib/render.ts plugin/src/lib/render.test.ts
git commit -m "Add shared SVG ring + badge renderer"
```

---

## Task 7: Prerequisites for SDK glue (manual gate)

**No code.** Before Tasks 8–11 the user must:

- [ ] Install **Node.js 24+** (e.g. via the official installer or `nvm-windows`). Verify: `node --version` → `v24.x` or higher.
- [ ] Update the **Stream Deck app to 7.1+** (Stream Deck → Preferences → check for updates).
- [ ] Install the Elgato CLI: `npm install -g @elgato/cli`. Verify: `streamdeck --version`.

Stop here until all three are confirmed.

---

## Task 8: Scaffold the Stream Deck plugin + manifest with two actions

**Files:**
- Create (via wizard): `plugin/<uuid>.sdPlugin/manifest.json` and `src/plugin.ts`

- [ ] **Step 1: Scaffold**

Run (from `plugin/`):
```bash
streamdeck create
```
Wizard answers: Author = `ErbenDriessen`; Plugin name = `Claude`; UUID = `com.erbendriessen.claude`; choose the TypeScript template. This generates `manifest.json`, an example action, and build config.

- [ ] **Step 2: Edit `manifest.json` to declare exactly two actions**

Replace the generated `Actions` array with:
```json
"Actions": [
  {
    "Name": "Session Limit",
    "UUID": "com.erbendriessen.claude.session",
    "Icon": "imgs/actions/session/icon",
    "States": [{ "Image": "imgs/actions/session/key" }],
    "Tooltip": "Claude 5-hour session limit used %"
  },
  {
    "Name": "Peak Ticker",
    "UUID": "com.erbendriessen.claude.peak",
    "Icon": "imgs/actions/peak/icon",
    "States": [{ "Image": "imgs/actions/peak/key" }],
    "Tooltip": "Anthropic peak / off-peak window"
  }
]
```

- [ ] **Step 3: Reconcile generated tooling with our Vitest setup**

Keep the SDK's generated `package.json` build scripts; merge in our `"test": "vitest run"` script and the `vitest` devDependency if the wizard overwrote them. Run `npm install`.

- [ ] **Step 4: Verify it builds**

Run: `npm run build`
Expected: compiles with no errors (actions still empty placeholders).

- [ ] **Step 5: Commit**

```bash
git add plugin/
git commit -m "Scaffold Stream Deck plugin with session + peak actions"
```

---

## Task 9: Wire the Session-Limit action

**Files:**
- Create: `plugin/src/actions/session-limit.ts`
- Modify: `plugin/src/plugin.ts` (register action)

- [ ] **Step 1: Implement the action**

```typescript
// plugin/src/actions/session-limit.ts
import streamDeck, { action, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { readUsageFile, deriveSessionState } from "../lib/usage.js";
import { renderRingSvg, formatCountdown } from "../lib/render.js";

const POLL_MS = 5000;

@action({ UUID: "com.erbendriessen.claude.session" })
export class SessionLimit extends SingletonAction {
  private timers = new Map<string, NodeJS.Timeout>();

  override onWillAppear(ev: WillAppearEvent): void {
    this.refresh(ev.action);
    const t = setInterval(() => this.refresh(ev.action), POLL_MS);
    this.timers.set(ev.action.id, t);
  }
  override onWillDisappear(ev: WillDisappearEvent): void {
    const t = this.timers.get(ev.action.id);
    if (t) clearInterval(t);
    this.timers.delete(ev.action.id);
  }

  private refresh(a: { setImage: (s: string) => void; setTitle: (s: string) => void }): void {
    const nowS = Math.floor(Date.now() / 1000);
    const state = deriveSessionState(readUsageFile(), nowS);
    switch (state.kind) {
      case "setup": a.setImage(renderRingSvg(0, "—")); break;
      case "reset": a.setImage(renderRingSvg(0, "reset")); break;
      case "stale": a.setImage(renderRingSvg(0, "idle")); break;
      case "ok": a.setImage(renderRingSvg(state.percentage, formatCountdown(state.secondsToReset))); break;
    }
  }
}
```

- [ ] **Step 2: Register in `plugin.ts`**

```typescript
import streamDeck from "@elgato/streamdeck";
import { SessionLimit } from "./actions/session-limit.js";
streamDeck.actions.registerAction(new SessionLimit());
streamDeck.connect();
```

- [ ] **Step 3: Build + load and verify on device**

Run: `npm run build && streamdeck restart com.erbendriessen.claude`
Expected: drag "Session Limit" onto a key → it shows the ring. With a populated `~/.claude/usage.json` it shows the real % + countdown; with the file deleted it shows `—`.

- [ ] **Step 4: Commit**

```bash
git add plugin/src/actions/session-limit.ts plugin/src/plugin.ts
git commit -m "Wire session-limit action polling usage.json"
```

---

## Task 10: Wire the Peak-Ticker action

**Files:**
- Create: `plugin/src/actions/peak-ticker.ts`
- Modify: `plugin/src/plugin.ts` (register)

- [ ] **Step 1: Implement the action**

```typescript
// plugin/src/actions/peak-ticker.ts
import { action, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { derivePeakState } from "../lib/peak.js";
import { renderBadgeSvg, formatCountdown } from "../lib/render.js";

const POLL_MS = 15000;

@action({ UUID: "com.erbendriessen.claude.peak" })
export class PeakTicker extends SingletonAction {
  private timers = new Map<string, NodeJS.Timeout>();

  override onWillAppear(ev: WillAppearEvent): void {
    this.refresh(ev.action);
    const t = setInterval(() => this.refresh(ev.action), POLL_MS);
    this.timers.set(ev.action.id, t);
  }
  override onWillDisappear(ev: WillDisappearEvent): void {
    const t = this.timers.get(ev.action.id);
    if (t) clearInterval(t);
    this.timers.delete(ev.action.id);
  }

  private refresh(a: { setImage: (s: string) => void }): void {
    const nowS = Math.floor(Date.now() / 1000);
    const s = derivePeakState(nowS);
    a.setImage(renderBadgeSvg(s.isPeak, formatCountdown(s.secondsToSwitch)));
  }
}
```

- [ ] **Step 2: Register in `plugin.ts`**

Add:
```typescript
import { PeakTicker } from "./actions/peak-ticker.js";
streamDeck.actions.registerAction(new PeakTicker());
```

- [ ] **Step 3: Build + load and verify on device**

Run: `npm run build && streamdeck restart com.erbendriessen.claude`
Expected: drag "Peak Ticker" onto a key → green OFF-PEAK on weekends/off-hours, red PEAK weekdays 13:00–19:00 UTC, with a countdown to the next switch.

- [ ] **Step 4: Commit**

```bash
git add plugin/src/actions/peak-ticker.ts plugin/src/plugin.ts
git commit -m "Wire peak-ticker action with client-side schedule"
```

---

## Task 11: README + final verification

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

Cover: what it does (2 actions), the `~/.claude/usage.json` data flow, install (`statusline.js` → `~/.claude/`, `streamdeck` build/link), prerequisites (Node 24+, Stream Deck 7.1+), and the peak schedule note (weekdays 13:00–19:00 UTC, editable in `peak.ts`).

- [ ] **Step 2: Full test pass**

Run: from repo root `node --test statusline/` and from `plugin/` `npm test`.
Expected: all suites green.

- [ ] **Step 3: Manual end-to-end check**

Use Claude Code for a moment so the live status line writes `usage.json`; confirm the Session Limit key updates within ~5s and the Peak key reflects the current UTC window.

- [ ] **Step 4: Commit + push**

```bash
git add README.md
git commit -m "Add README and finalize plugin"
git push
```

---

## Notes for the executor

- **No `Co-Authored-By` / "Generated with" trailers** in any commit (user preference).
- Prefix git/build commands with `rtk` (user has the RTK token filter installed).
- Tasks 1–6 are fully doable now on Node 22. Tasks 7–11 are gated on the user installing Node 24+, the Stream Deck app 7.1+, and the Elgato CLI.
- SDK method names (`setImage`, `setTitle`, `onWillAppear`, `registerAction`) and the `@elgato/streamdeck` import surface may differ slightly by SDK version — verify against `streamdeck create` output during Task 8 and adjust the thin glue in Tasks 9–10 if needed. The pure `lib/` modules are SDK-independent and stay as tested.
```
