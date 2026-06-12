# Claude Code Usage Monitor v1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the working prototype into "Claude Code Usage Monitor" — a polished, customizable, Marketplace-ready Stream Deck plugin with a horseshoe gauge, a clean settings panel, official-data-with-fallback, original artwork, and a submittable package.

**Architecture:** Pure, unit-tested `lib/` modules (gauge geometry, theme, settings, ccusage parse, source resolution) drive thin SDK action glue and two Property Inspectors. The Session Limit action resolves its number from `~/.claude/usage.json` (official, written by our status line) and falls back to `ccusage`; a Property Inspector button installs the status line for the official path.

**Tech Stack:** TypeScript + Vitest + `@elgato/streamdeck` 2.x, rollup build, SVG rendering, Node 24 build tooling.

---

## File Structure

```
plugin/src/
  lib/
    usage.ts      # usage.json read + session state machine (exists, pure)
    ccusage.ts    # spawn + parse `ccusage blocks --active --json` (new)
    source.ts     # resolve session reading: usage.json -> ccusage -> setup (new)
    peak.ts       # peak schedule + next switch (exists, pure)
    gauge.ts      # pure geometry per gauge style (new)
    render.ts     # SVG builders: horseshoe/ring/bar + badge (extend)
    theme.ts      # colour/threshold/background from settings (new)
    settings.ts   # setting types + defaults + merge (new)
    installer.ts  # status-line install/patch (new; FS side-effects isolated)
  actions/
    session-limit.ts  # read settings, resolve source, render (extend)
    peak-ticker.ts    # read settings, render (extend)
  plugin.ts
  ui/
    session-limit.html # Property Inspector (new)
    peak-ticker.html   # Property Inspector (new)
plugin/scripts/
  copy-statusline.mjs  # prebuild: copy statusline.js into assets/ (new)
```

**Phases:** (1) visual core, (2) settings + PI, (3) data source + installer, (4) artwork, (5) package & submit. Each phase ends green and committed.

---

# Phase 1 — Visual core

## Task 1: `lib/gauge.ts` — pure geometry (TDD)

**Files:**
- Create: `plugin/src/lib/gauge.test.ts`
- Create: `plugin/src/lib/gauge.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `plugin/`): `npm test`
Expected: FAIL — cannot resolve `./gauge.js`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// plugin/src/lib/gauge.ts
// Pure geometry for the 144x144 key. r=52 => circumference ~326.7.
// Horseshoe is a 270deg arc => 0.75 * circumference ~245.
export const R = 52;
export const CIRC = 2 * Math.PI * R;
export const HORSESHOE_ARC = CIRC * 0.75;
export const BAR_TRACK = 120;

export function clampPct(pct: number): number {
  return Math.max(0, Math.min(100, pct));
}

export function horseshoeDash(pct: number): number {
  return (clampPct(pct) / 100) * HORSESHOE_ARC;
}

export function ringDash(pct: number): number {
  return (clampPct(pct) / 100) * CIRC;
}

export function barWidth(pct: number): number {
  return (clampPct(pct) / 100) * BAR_TRACK;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: gauge tests pass (4).

- [ ] **Step 5: Commit**

```bash
git add plugin/src/lib/gauge.ts plugin/src/lib/gauge.test.ts
git commit -m "Add pure gauge geometry (horseshoe/ring/bar)"
```

---

## Task 2: `lib/theme.ts` — colour + background resolution (TDD)

**Files:**
- Create: `plugin/src/lib/theme.test.ts`
- Create: `plugin/src/lib/theme.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./theme.js`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// plugin/src/lib/theme.ts
export interface ColourSettings {
  colourMode: "heat" | "solid";
  accent: string;
  warnAt: number;
  dangerAt: number;
}

export function fillColour(pct: number, s: ColourSettings): string {
  if (s.colourMode === "solid") return s.accent;
  if (pct >= s.dangerAt) return "#f85149";
  if (pct >= s.warnAt) return "#d29922";
  return "#3fb950";
}

export interface Palette {
  bg: string;
  text: string;
  track: string;
  muted: string;
}

export function palette(background: "dark" | "light"): Palette {
  return background === "light"
    ? { bg: "#f6f8fa", text: "#1f2328", track: "#d0d7de", muted: "#6e7781" }
    : { bg: "#0d1117", text: "#ffffff", track: "#21262d", muted: "#8b949e" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: theme tests pass (4).

- [ ] **Step 5: Commit**

```bash
git add plugin/src/lib/theme.ts plugin/src/lib/theme.test.ts
git commit -m "Add theme colour + palette resolution"
```

---

## Task 3: `lib/render.ts` — three gauge styles + badge (TDD)

**Files:**
- Modify: `plugin/src/lib/render.ts`
- Modify: `plugin/src/lib/render.test.ts`

- [ ] **Step 1: Write the failing test (append)**

```typescript
import { describe, it, expect } from "vitest";
import { renderGauge, renderBadge, formatCountdown } from "./render.js";

const decode = (url: string) => Buffer.from(url.split(",")[1], "base64").toString("utf8");
const colours = { colourMode: "heat" as const, accent: "#3fb950", warnAt: 70, dangerAt: 90 };
const opts = { pct: 42, countdown: "2u14", showCountdown: true, background: "dark" as const, colours };

describe("renderGauge", () => {
  it("horseshoe: data url, shows pct, uses rotate(135) and dasharray", () => {
    const svg = decode(renderGauge({ ...opts, style: "horseshoe" }));
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
});

describe("renderBadge", () => {
  it("shows PEAK and the countdown", () => {
    const svg = decode(renderBadge({ isPeak: true, countdown: "1u00", showCountdown: true, background: "dark" }));
    expect(svg).toContain("PEAK");
    expect(svg).toContain("1u00");
  });
});
```

Keep the existing `formatCountdown` tests; remove the old `renderRingSvg`/`renderBadgeSvg`/`heatColor` tests (those functions are replaced below).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `renderGauge`/`renderBadge` not exported.

- [ ] **Step 3: Replace `render.ts` implementation**

```typescript
// plugin/src/lib/render.ts
import { R, CIRC, HORSESHOE_ARC, BAR_TRACK, horseshoeDash, ringDash, barWidth, clampPct } from "./gauge.js";
import { fillColour, palette, type ColourSettings } from "./theme.js";

const SIZE = 144;
const CX = SIZE / 2;
const CY = SIZE / 2;

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

export type GaugeStyle = "horseshoe" | "ring" | "bar";

export interface GaugeOpts {
  pct: number;
  countdown: string;
  showCountdown: boolean;
  background: "dark" | "light";
  colours: ColourSettings;
  style: GaugeStyle;
}

function centreText(text: string, p: { text: string; muted: string }, countdown: string, showCountdown: boolean, yShift = 0): string {
  const sub = showCountdown && countdown
    ? `<text x="${CX}" y="${CY + 28 + yShift}" fill="${p.muted}" font-family="sans-serif" font-size="18" text-anchor="middle" dominant-baseline="middle">${countdown}</text>`
    : "";
  return `<text x="${CX}" y="${CY - 2 + yShift}" fill="${p.text}" font-family="sans-serif" font-size="36" font-weight="500" text-anchor="middle" dominant-baseline="middle">${text}</text>${sub}`;
}

export function renderGauge(o: GaugeOpts): string {
  const p = palette(o.background);
  const colour = fillColour(o.pct, o.colours);
  const pctText = `${Math.round(clampPct(o.pct))}%`;
  let track = "";
  let fill = "";

  if (o.style === "ring") {
    track = `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${p.track}" stroke-width="12"/>`;
    fill = `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${colour}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${ringDash(o.pct)} ${CIRC}" transform="rotate(-90 ${CX} ${CY})"/>`;
  } else if (o.style === "bar") {
    const x0 = (SIZE - BAR_TRACK) / 2;
    track = `<rect x="${x0}" y="${CY + 34}" width="${BAR_TRACK}" height="12" rx="6" fill="${p.track}"/>`;
    fill = `<rect x="${x0}" y="${CY + 34}" width="${barWidth(o.pct)}" height="12" rx="6" fill="${colour}"/>`;
  } else {
    // horseshoe (default / fallback)
    const gap = CIRC - HORSESHOE_ARC;
    track = `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${p.track}" stroke-width="12" stroke-dasharray="${HORSESHOE_ARC} ${gap}" transform="rotate(135 ${CX} ${CY})"/>`;
    fill = `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${colour}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${horseshoeDash(o.pct)} ${CIRC}" transform="rotate(135 ${CX} ${CY})"/>`;
  }

  const yShift = o.style === "bar" ? -8 : 0;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="100%" height="100%" rx="0" fill="${p.bg}"/>
  ${track}
  ${fill}
  ${centreText(pctText, p, o.countdown, o.showCountdown, yShift)}
</svg>`;
  return toDataUrl(svg);
}

export interface BadgeOpts {
  isPeak: boolean;
  countdown: string;
  showCountdown: boolean;
  background: "dark" | "light";
}

export function renderBadge(o: BadgeOpts): string {
  const p = palette(o.background);
  const colour = o.isPeak ? "#f85149" : "#3fb950";
  const label = o.isPeak ? "PEAK" : "OFF-PEAK";
  const sub = o.showCountdown && o.countdown
    ? `<text x="${CX}" y="124" fill="${p.muted}" font-family="sans-serif" font-size="18" text-anchor="middle" dominant-baseline="middle">${o.countdown}</text>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="100%" height="100%" fill="${p.bg}"/>
  <circle cx="${CX}" cy="48" r="22" fill="${colour}"/>
  <text x="${CX}" y="96" fill="${p.text}" font-family="sans-serif" font-size="${o.isPeak ? 28 : 22}" font-weight="500" text-anchor="middle" dominant-baseline="middle">${label}</text>
  ${sub}
</svg>`;
  return toDataUrl(svg);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: render tests pass; gauge + theme still green.

- [ ] **Step 5: Commit**

```bash
git add plugin/src/lib/render.ts plugin/src/lib/render.test.ts
git commit -m "Render three gauge styles + badge from theme/gauge"
```

---

## Task 4: Wire actions to the new renderer (hard-coded defaults for now)

**Files:**
- Modify: `plugin/src/actions/session-limit.ts`
- Modify: `plugin/src/actions/peak-ticker.ts`

- [ ] **Step 1: Update Session Limit `#draw`**

Replace the body of `#draw` in `session-limit.ts` with:

```typescript
	#draw(target: { setImage(image: string): Promise<void> }): void {
		const nowS = Math.floor(Date.now() / 1000);
		const state = deriveSessionState(readUsageFile(), nowS);
		const colours = { colourMode: "heat" as const, accent: "#3fb950", warnAt: 70, dangerAt: 90 };
		const common = { showCountdown: true, background: "dark" as const, colours, style: "horseshoe" as const };
		switch (state.kind) {
			case "setup":
				void target.setImage(renderGauge({ ...common, pct: 0, countdown: "—" }));
				break;
			case "reset":
				void target.setImage(renderGauge({ ...common, pct: 0, countdown: "reset" }));
				break;
			case "stale":
				void target.setImage(renderGauge({ ...common, pct: 0, countdown: "idle" }));
				break;
			case "ok":
				void target.setImage(renderGauge({ ...common, pct: state.percentage, countdown: formatCountdown(state.secondsToReset) }));
				break;
		}
	}
```

Update the imports at the top of `session-limit.ts`:

```typescript
import { readUsageFile, deriveSessionState } from "../lib/usage.js";
import { renderGauge, formatCountdown } from "../lib/render.js";
```

- [ ] **Step 2: Update Peak Ticker `#draw`**

Replace the body of `#draw` in `peak-ticker.ts` with:

```typescript
	#draw(target: { setImage(image: string): Promise<void> }): void {
		const nowS = Math.floor(Date.now() / 1000);
		const state = derivePeakState(nowS);
		void target.setImage(renderBadge({ isPeak: state.isPeak, countdown: formatCountdown(state.secondsToSwitch), showCountdown: true, background: "dark" }));
	}
```

Update imports:

```typescript
import { derivePeakState } from "../lib/peak.js";
import { renderBadge, formatCountdown } from "../lib/render.js";
```

- [ ] **Step 3: Build + on-device check**

Run (PowerShell, Node 24): `cd plugin; npm run build; & "$env:APPDATA\npm\streamdeck.cmd" restart com.erbendriessen.claude`
Expected: both keys render; Session Limit now shows the horseshoe gauge.

- [ ] **Step 4: Commit**

```bash
git add plugin/src/actions/session-limit.ts plugin/src/actions/peak-ticker.ts
git commit -m "Wire actions to horseshoe renderer"
```

---

# Phase 2 — Settings + Property Inspector

## Task 5: `lib/settings.ts` — types, defaults, merge (TDD)

**Files:**
- Create: `plugin/src/lib/settings.test.ts`
- Create: `plugin/src/lib/settings.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./settings.js`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// plugin/src/lib/settings.ts
export interface SessionSettings {
  window: "fiveHour" | "sevenDay";
  showCountdown: boolean;
  gaugeStyle: "horseshoe" | "ring" | "bar";
  colourMode: "heat" | "solid";
  accent: string;
  background: "dark" | "light";
  warnAt: number;
  dangerAt: number;
}

export interface PeakSettings {
  showCountdown: boolean;
  background: "dark" | "light";
  peakStartUTC: number;
  peakEndUTC: number;
}

export const SESSION_DEFAULTS: SessionSettings = {
  window: "fiveHour",
  showCountdown: true,
  gaugeStyle: "horseshoe",
  colourMode: "heat",
  accent: "#3fb950",
  background: "dark",
  warnAt: 70,
  dangerAt: 90,
};

export const PEAK_DEFAULTS: PeakSettings = {
  showCountdown: true,
  background: "dark",
  peakStartUTC: 13,
  peakEndUTC: 19,
};

export function withSessionDefaults(s: Partial<SessionSettings>): SessionSettings {
  return { ...SESSION_DEFAULTS, ...s };
}

export function withPeakDefaults(s: Partial<PeakSettings>): PeakSettings {
  return { ...PEAK_DEFAULTS, ...s };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: settings tests pass (4).

- [ ] **Step 5: Commit**

```bash
git add plugin/src/lib/settings.ts plugin/src/lib/settings.test.ts
git commit -m "Add settings types, defaults, and merge"
```

---

## Task 6: Session Limit reads settings

**Files:**
- Modify: `plugin/src/actions/session-limit.ts`

- [ ] **Step 1: Use persisted settings + chosen window**

Replace the action body so `onWillAppear` reads settings and `#draw` honours them:

```typescript
import { action, SingletonAction, type WillAppearEvent, type WillDisappearEvent, type DidReceiveSettingsEvent } from "@elgato/streamdeck";
import { readUsageFile, deriveSessionState } from "../lib/usage.js";
import { renderGauge, formatCountdown } from "../lib/render.js";
import { withSessionDefaults, type SessionSettings } from "../lib/settings.js";

const POLL_MS = 5000;

@action({ UUID: "com.erbendriessen.claude.session" })
export class SessionLimit extends SingletonAction {
	#timers = new Map<string, ReturnType<typeof setInterval>>();

	override onWillAppear(ev: WillAppearEvent): void {
		this.#draw(ev);
		const timer = setInterval(() => this.#draw(ev), POLL_MS);
		this.#timers.set(ev.action.id, timer);
	}

	override onWillDisappear(ev: WillDisappearEvent): void {
		const t = this.#timers.get(ev.action.id);
		if (t) clearInterval(t);
		this.#timers.delete(ev.action.id);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent): void {
		this.#draw(ev);
	}

	#draw(ev: { action: { setImage(image: string): Promise<void> }; payload: { settings: Partial<SessionSettings> } }): void {
		const s = withSessionDefaults(ev.payload.settings ?? {});
		const nowS = Math.floor(Date.now() / 1000);
		const file = readUsageFile();
		const state = deriveSessionState(file, nowS);
		const colours = { colourMode: s.colourMode, accent: s.accent, warnAt: s.warnAt, dangerAt: s.dangerAt };
		const common = { showCountdown: s.showCountdown, background: s.background, colours, style: s.gaugeStyle };

		if (state.kind === "ok" && file) {
			const win = s.window === "sevenDay" && file.sevenDay ? file.sevenDay : file.fiveHour;
			const secs = Math.max(0, win.resetsAt - nowS);
			void ev.action.setImage(renderGauge({ ...common, pct: win.usedPercentage, countdown: formatCountdown(secs) }));
			return;
		}
		const label = state.kind === "reset" ? "reset" : state.kind === "stale" ? "idle" : "—";
		void ev.action.setImage(renderGauge({ ...common, pct: 0, countdown: label }));
	}
}
```

- [ ] **Step 2: Build + verify settings round-trip**

Run: `cd plugin; npm run build; & "$env:APPDATA\npm\streamdeck.cmd" restart com.erbendriessen.claude`
Expected: still renders (PI not built yet, so defaults apply).

- [ ] **Step 3: Commit**

```bash
git add plugin/src/actions/session-limit.ts
git commit -m "Session action reads persisted settings + chosen window"
```

---

## Task 7: Peak Ticker reads settings

**Files:**
- Modify: `plugin/src/actions/peak-ticker.ts`

- [ ] **Step 1: Honour peak settings (background, countdown, schedule override)**

```typescript
import { action, SingletonAction, type WillAppearEvent, type WillDisappearEvent, type DidReceiveSettingsEvent } from "@elgato/streamdeck";
import { derivePeakState } from "../lib/peak.js";
import { renderBadge, formatCountdown } from "../lib/render.js";
import { withPeakDefaults, type PeakSettings } from "../lib/settings.js";

const POLL_MS = 15000;

@action({ UUID: "com.erbendriessen.claude.peak" })
export class PeakTicker extends SingletonAction {
	#timers = new Map<string, ReturnType<typeof setInterval>>();

	override onWillAppear(ev: WillAppearEvent): void {
		this.#draw(ev);
		const timer = setInterval(() => this.#draw(ev), POLL_MS);
		this.#timers.set(ev.action.id, timer);
	}

	override onWillDisappear(ev: WillDisappearEvent): void {
		const t = this.#timers.get(ev.action.id);
		if (t) clearInterval(t);
		this.#timers.delete(ev.action.id);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent): void {
		this.#draw(ev);
	}

	#draw(ev: { action: { setImage(image: string): Promise<void> }; payload: { settings: Partial<PeakSettings> } }): void {
		const s = withPeakDefaults(ev.payload.settings ?? {});
		const nowS = Math.floor(Date.now() / 1000);
		const schedule = { startHourUTC: s.peakStartUTC, endHourUTC: s.peakEndUTC, weekdays: [1, 2, 3, 4, 5] } as const;
		const state = derivePeakState(nowS, schedule);
		void ev.action.setImage(renderBadge({ isPeak: state.isPeak, countdown: formatCountdown(state.secondsToSwitch), showCountdown: s.showCountdown, background: s.background }));
	}
}
```

Note: `derivePeakState`'s second param type must accept `{ startHourUTC; endHourUTC; weekdays }`. In `peak.ts` change the `schedule` param type from `typeof PEAK_SCHEDULE` to a structural interface:

```typescript
export interface PeakSchedule { startHourUTC: number; endHourUTC: number; weekdays: readonly number[]; }
```
and update `peakAt`/`nextBoundary`/`derivePeakState` signatures to use `PeakSchedule`. Re-run `npm test` to confirm peak tests still pass.

- [ ] **Step 2: Build + verify**

Run: `cd plugin; npm run build; & "$env:APPDATA\npm\streamdeck.cmd" restart com.erbendriessen.claude`
Expected: peak badge still renders.

- [ ] **Step 3: Commit**

```bash
git add plugin/src/actions/peak-ticker.ts plugin/src/lib/peak.ts plugin/src/lib/peak.test.ts
git commit -m "Peak action reads settings + structural schedule type"
```

---

## Task 8: Property Inspectors (session + peak)

**Files:**
- Create: `plugin/com.erbendriessen.claude.sdPlugin/ui/session-limit.html`
- Create: `plugin/com.erbendriessen.claude.sdPlugin/ui/peak-ticker.html`
- Modify: `plugin/com.erbendriessen.claude.sdPlugin/manifest.json` (add `PropertyInspectorPath`)

- [ ] **Step 1: Add `PropertyInspectorPath` to both actions in the manifest**

In each action object add: `"PropertyInspectorPath": "ui/session-limit.html"` (and `ui/peak-ticker.html` respectively).

- [ ] **Step 2: Write the Session Limit PI**

Use Elgato's `sdpi-components` (bundled web components for Property Inspectors). Create `ui/session-limit.html`:

```html
<!DOCTYPE html>
<html><head><meta charset="utf-8" /><script src="https://sdpi-components.dev/releases/v4/sdpi-components.js"></script></head>
<body>
  <sdpi-item label="Window">
    <sdpi-select setting="window" default="fiveHour">
      <option value="fiveHour">5-hour session</option>
      <option value="sevenDay">7-day</option>
    </sdpi-select>
  </sdpi-item>
  <sdpi-item label="Gauge">
    <sdpi-select setting="gaugeStyle" default="horseshoe">
      <option value="horseshoe">Horseshoe</option>
      <option value="ring">Full ring</option>
      <option value="bar">Bar</option>
    </sdpi-select>
  </sdpi-item>
  <sdpi-item label="Countdown">
    <sdpi-checkbox setting="showCountdown" checked></sdpi-checkbox>
  </sdpi-item>
  <sdpi-item label="Colour">
    <sdpi-select setting="colourMode" default="heat">
      <option value="heat">Auto (green→red)</option>
      <option value="solid">Single colour</option>
    </sdpi-select>
  </sdpi-item>
  <sdpi-item label="Accent">
    <sdpi-color setting="accent" default="#3fb950"></sdpi-color>
  </sdpi-item>
  <sdpi-item label="Background">
    <sdpi-select setting="background" default="dark">
      <option value="dark">Dark</option>
      <option value="light">Light</option>
    </sdpi-select>
  </sdpi-item>
  <details>
    <summary>Advanced</summary>
    <sdpi-item label="Yellow at %">
      <sdpi-range setting="warnAt" min="0" max="100" default="70" showlabels></sdpi-range>
    </sdpi-item>
    <sdpi-item label="Red at %">
      <sdpi-range setting="dangerAt" min="0" max="100" default="90" showlabels></sdpi-range>
    </sdpi-item>
  </details>
  <sdpi-item label="Official tracking">
    <sdpi-button id="setup">Set up official tracking</sdpi-button>
  </sdpi-item>
  <script>
    document.getElementById("setup").addEventListener("click", () => {
      SDPIComponents.streamDeckClient.send("sendToPlugin", { action: "installStatusLine" });
    });
  </script>
</body></html>
```

- [ ] **Step 3: Write the Peak Ticker PI**

Create `ui/peak-ticker.html`:

```html
<!DOCTYPE html>
<html><head><meta charset="utf-8" /><script src="https://sdpi-components.dev/releases/v4/sdpi-components.js"></script></head>
<body>
  <sdpi-item label="Countdown">
    <sdpi-checkbox setting="showCountdown" checked></sdpi-checkbox>
  </sdpi-item>
  <sdpi-item label="Background">
    <sdpi-select setting="background" default="dark">
      <option value="dark">Dark</option>
      <option value="light">Light</option>
    </sdpi-select>
  </sdpi-item>
  <details>
    <summary>Advanced</summary>
    <sdpi-item label="Peak start (UTC hour)">
      <sdpi-range setting="peakStartUTC" min="0" max="23" default="13" showlabels></sdpi-range>
    </sdpi-item>
    <sdpi-item label="Peak end (UTC hour)">
      <sdpi-range setting="peakEndUTC" min="0" max="23" default="19" showlabels></sdpi-range>
    </sdpi-item>
  </details>
</body></html>
```

- [ ] **Step 4: Build + verify PI on device**

Run: `cd plugin; npm run build; & "$env:APPDATA\npm\streamdeck.cmd" restart com.erbendriessen.claude`
Expected: selecting a key shows the settings; changing Gauge to Bar/Ring redraws the key live (via `onDidReceiveSettings`).

- [ ] **Step 5: Commit**

```bash
git add plugin/com.erbendriessen.claude.sdPlugin/ui plugin/com.erbendriessen.claude.sdPlugin/manifest.json
git commit -m "Add Property Inspectors for session + peak"
```

---

# Phase 3 — Data source (REVISED)

> **Revision 2026-06-12:** Discovery — Anthropic exposes a live usage endpoint
> `GET https://api.anthropic.com/api/oauth/usage` (headers: `Authorization: Bearer
> <accessToken>`, `anthropic-beta: oauth-2025-04-20`) returning
> `five_hour.utilization`/`resets_at` and `seven_day.*`. This is live and
> terminal-independent, so it becomes the PRIMARY source. Tasks 9–13 below are
> superseded by: `credentials.ts` (read token), `usageApi.ts` (call + parse),
> `source.ts` (API → usage.json fallback → setup). The ccusage module, the
> installer, and the "Set up official tracking" button are DROPPED. Remove the
> setup button from `ui/session-limit.html`.

## Task 9: `lib/ccusage.ts` — parse active block (TDD)

**Files:**
- Create: `plugin/src/lib/ccusage.test.ts`
- Create: `plugin/src/lib/ccusage.ts`

- [ ] **Step 1: Write the failing test (pure parser only)**

```typescript
import { describe, it, expect } from "vitest";
import { parseActiveBlock } from "./ccusage.js";

describe("parseActiveBlock", () => {
  it("returns null when no active block", () => {
    expect(parseActiveBlock(JSON.stringify({ blocks: [] }))).toBeNull();
  });
  it("extracts start/end + remaining minutes from the active block", () => {
    const json = JSON.stringify({ blocks: [{ isActive: true, startTime: "2026-06-12T15:00:00Z", endTime: "2026-06-12T20:00:00Z", projection: { remainingMinutes: 120 } }] });
    const b = parseActiveBlock(json);
    expect(b?.remainingMinutes).toBe(120);
    expect(b?.startMs).toBe(Date.parse("2026-06-12T15:00:00Z"));
    expect(b?.endMs).toBe(Date.parse("2026-06-12T20:00:00Z"));
  });
  it("returns null on malformed json", () => {
    expect(parseActiveBlock("not json")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./ccusage.js`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// plugin/src/lib/ccusage.ts
import { execFile } from "node:child_process";

export interface ActiveBlock {
  startMs: number;
  endMs: number;
  remainingMinutes: number;
}

/** Pure parser for `ccusage blocks --active --json` output. */
export function parseActiveBlock(stdout: string): ActiveBlock | null {
  try {
    const data = JSON.parse(stdout) as { blocks?: Array<Record<string, unknown>> };
    const b = (data.blocks ?? [])[0];
    if (!b || !b.isActive || !b.startTime || !b.endTime) return null;
    const proj = (b.projection ?? {}) as { remainingMinutes?: number };
    return {
      startMs: Date.parse(String(b.startTime)),
      endMs: Date.parse(String(b.endTime)),
      remainingMinutes: typeof proj.remainingMinutes === "number" ? proj.remainingMinutes : 0,
    };
  } catch {
    return null;
  }
}

/** Side-effecting: runs ccusage and resolves the parsed block (or null). */
export function fetchActiveBlock(timeoutMs = 8000): Promise<ActiveBlock | null> {
  return new Promise((resolve) => {
    execFile(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["-y", "ccusage@latest", "blocks", "--active", "--json"],
      { timeout: timeoutMs, windowsHide: true },
      (err, stdout) => resolve(err ? null : parseActiveBlock(stdout)),
    );
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: ccusage parser tests pass (3).

- [ ] **Step 5: Commit**

```bash
git add plugin/src/lib/ccusage.ts plugin/src/lib/ccusage.test.ts
git commit -m "Add ccusage active-block parser + fetch"
```

---

## Task 10: `lib/source.ts` — resolution priority (TDD)

**Files:**
- Create: `plugin/src/lib/source.test.ts`
- Create: `plugin/src/lib/source.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { resolveSessionReading } from "./source.js";
import type { UsageFile } from "./usage.js";
import type { ActiveBlock } from "./ccusage.js";

const fresh: UsageFile = { schema: 1, updatedAt: 1000, fiveHour: { usedPercentage: 40, resetsAt: 5000 } };

describe("resolveSessionReading", () => {
  it("uses official usage.json when fresh", () => {
    const r = resolveSessionReading(fresh, null, 2000, "fiveHour");
    expect(r).toEqual({ kind: "official", pct: 40, secondsToReset: 3000 });
  });
  it("falls back to ccusage window-progress when file missing", () => {
    const block: ActiveBlock = { startMs: 0, endMs: 300_000 * 1000, remainingMinutes: 100 };
    const r = resolveSessionReading(null, block, 200 * 60, "fiveHour");
    // 200 of 300 minutes elapsed -> ~67% window progress, ~100 min to reset
    expect(r.kind).toBe("estimate");
    if (r.kind === "estimate") {
      expect(Math.round(r.pct)).toBe(67);
      expect(Math.round(r.secondsToReset / 60)).toBe(100);
    }
  });
  it("returns setup when neither source is available", () => {
    expect(resolveSessionReading(null, null, 0, "fiveHour").kind).toBe("setup");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./source.js`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// plugin/src/lib/source.ts
import { deriveSessionState, type UsageFile } from "./usage.js";
import type { ActiveBlock } from "./ccusage.js";

export type SessionReading =
  | { kind: "official"; pct: number; secondsToReset: number }
  | { kind: "estimate"; pct: number; secondsToReset: number }
  | { kind: "setup" };

/** Priority: fresh official file -> ccusage window-progress estimate -> setup. */
export function resolveSessionReading(
  file: UsageFile | null,
  block: ActiveBlock | null,
  nowS: number,
  window: "fiveHour" | "sevenDay",
): SessionReading {
  const state = deriveSessionState(file, nowS);
  if (state.kind === "ok" && file) {
    const win = window === "sevenDay" && file.sevenDay ? file.sevenDay : file.fiveHour;
    return { kind: "official", pct: win.usedPercentage, secondsToReset: Math.max(0, win.resetsAt - nowS) };
  }
  if (block) {
    const totalS = (block.endMs - block.startMs) / 1000;
    const elapsedS = nowS - block.startMs / 1000;
    const pct = totalS > 0 ? Math.max(0, Math.min(100, (elapsedS / totalS) * 100)) : 0;
    return { kind: "estimate", pct, secondsToReset: block.remainingMinutes * 60 };
  }
  return { kind: "setup" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: source tests pass (3).

- [ ] **Step 5: Commit**

```bash
git add plugin/src/lib/source.ts plugin/src/lib/source.test.ts
git commit -m "Add session-reading source resolution (official -> estimate -> setup)"
```

---

## Task 11: Session action uses ccusage fallback

**Files:**
- Modify: `plugin/src/actions/session-limit.ts`

- [ ] **Step 1: Cache a ccusage block and use `resolveSessionReading`**

Add to the class a cached block refreshed every 60s, and use it in `#draw`:

```typescript
import { fetchActiveBlock, type ActiveBlock } from "../lib/ccusage.js";
import { resolveSessionReading } from "../lib/source.js";
// ...inside the class:
	#block: ActiveBlock | null = null;
	#blockAt = 0;

	async #ensureBlock(): Promise<void> {
		const now = Date.now();
		if (now - this.#blockAt < 60_000) return;
		this.#blockAt = now;
		this.#block = await fetchActiveBlock();
	}
```

In `#draw`, replace the official-only logic with:

```typescript
		const nowS = Math.floor(Date.now() / 1000);
		const reading = resolveSessionReading(readUsageFile(), this.#block, nowS, s.window);
		if (reading.kind === "setup") {
			void ev.action.setImage(renderGauge({ ...common, pct: 0, countdown: "—" }));
			return;
		}
		const suffix = reading.kind === "estimate" ? "≈" : "";
		void ev.action.setImage(renderGauge({ ...common, pct: reading.pct, countdown: suffix + formatCountdown(reading.secondsToReset) }));
```

Call `void this.#ensureBlock();` at the start of `onWillAppear` and inside the interval before `#draw` (so the fallback warms up only when official data is absent — guard: only fetch when `readUsageFile()` is null/stale to avoid needless spawns).

- [ ] **Step 2: Build + verify both paths**

Run: `cd plugin; npm run build; & "$env:APPDATA\npm\streamdeck.cmd" restart com.erbendriessen.claude`
Manual: with `~/.claude/usage.json` present → exact %; rename it → key falls back to a `≈`-prefixed estimate within ~60s; restore it → official returns.

- [ ] **Step 3: Commit**

```bash
git add plugin/src/actions/session-limit.ts
git commit -m "Session action falls back to ccusage estimate when official data absent"
```

---

## Task 12: `lib/installer.ts` — install status line + patch settings (TDD for pure parts)

**Files:**
- Create: `plugin/src/lib/installer.test.ts`
- Create: `plugin/src/lib/installer.ts`

- [ ] **Step 1: Write the failing test (pure merge logic)**

```typescript
import { describe, it, expect } from "vitest";
import { mergeStatusLine } from "./installer.js";

describe("mergeStatusLine", () => {
  it("adds a statusLine entry when none exists", () => {
    const out = mergeStatusLine({ model: "opus" }, "node C:/x/statusline.js");
    expect(out.changed).toBe(true);
    expect(out.settings.statusLine).toEqual({ type: "command", command: "node C:/x/statusline.js", refreshInterval: 5 });
    expect(out.settings.model).toBe("opus");
  });
  it("does NOT overwrite an existing statusLine", () => {
    const existing = { statusLine: { type: "command", command: "node other.js" } };
    const out = mergeStatusLine(existing, "node C:/x/statusline.js");
    expect(out.changed).toBe(false);
    expect(out.settings.statusLine.command).toBe("node other.js");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./installer.js`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// plugin/src/lib/installer.ts
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface MergeResult {
  changed: boolean;
  settings: Record<string, any>;
}

/** Pure: returns settings with a statusLine added IF absent. Never overwrites. */
export function mergeStatusLine(settings: Record<string, any>, command: string): MergeResult {
  if (settings.statusLine) return { changed: false, settings };
  return {
    changed: true,
    settings: { ...settings, statusLine: { type: "command", command, refreshInterval: 5 } },
  };
}

export interface InstallOutcome {
  ok: boolean;
  message: string;
}

/** Side-effecting: copies statusline.js to ~/.claude and patches settings.json. */
export function installStatusLine(): InstallOutcome {
  try {
    const claudeDir = join(homedir(), ".claude");
    if (!existsSync(claudeDir)) mkdirSync(claudeDir, { recursive: true });
    const dest = join(claudeDir, "statusline.js");
    const here = dirname(fileURLToPath(import.meta.url));
    // bundled at <sdPlugin>/bin/plugin.js; asset copied to <sdPlugin>/assets/statusline.js
    const asset = join(here, "..", "assets", "statusline.js");
    copyFileSync(asset, dest);

    const settingsPath = join(claudeDir, "settings.json");
    let settings: Record<string, any> = {};
    if (existsSync(settingsPath)) {
      writeFileSync(settingsPath + ".bak", readFileSync(settingsPath));
      settings = JSON.parse(readFileSync(settingsPath, "utf8"));
    }
    const command = `node ${dest.replace(/\\/g, "/")}`;
    const merged = mergeStatusLine(settings, command);
    if (merged.changed) {
      writeFileSync(settingsPath, JSON.stringify(merged.settings, null, 2));
      return { ok: true, message: "Official tracking installed. New Claude Code sessions will report your limit." };
    }
    return { ok: true, message: "A status line is already configured; left it untouched. statusline.js copied to ~/.claude." };
  } catch (e) {
    return { ok: false, message: `Could not set up tracking: ${(e as Error).message}` };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: installer merge tests pass (2).

- [ ] **Step 5: Commit**

```bash
git add plugin/src/lib/installer.ts plugin/src/lib/installer.test.ts
git commit -m "Add status-line installer (pure merge + FS install)"
```

---

## Task 13: Wire the Set-up button + ship the statusline asset

**Files:**
- Create: `plugin/scripts/copy-statusline.mjs`
- Modify: `plugin/package.json` (prebuild script)
- Modify: `plugin/src/plugin.ts` (handle `sendToPlugin`)

- [ ] **Step 1: Prebuild copy script**

```javascript
// plugin/scripts/copy-statusline.mjs
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, "..", "..", "statusline", "statusline.js");
const destDir = join(root, "..", "com.erbendriessen.claude.sdPlugin", "assets");
mkdirSync(destDir, { recursive: true });
copyFileSync(src, join(destDir, "statusline.js"));
console.log("Copied statusline.js into assets/");
```

- [ ] **Step 2: Add prebuild + gitignore the copied asset**

In `package.json` scripts add: `"prebuild": "node scripts/copy-statusline.mjs"`.
In `plugin/.gitignore` add: `com.erbendriessen.claude.sdPlugin/assets/`.

- [ ] **Step 3: Handle the PI message in `plugin.ts`**

```typescript
import streamDeck from "@elgato/streamdeck";
import { SessionLimit } from "./actions/session-limit.js";
import { PeakTicker } from "./actions/peak-ticker.js";
import { installStatusLine } from "./lib/installer.js";

streamDeck.actions.registerAction(new SessionLimit());
streamDeck.actions.registerAction(new PeakTicker());

streamDeck.ui.onSendToPlugin((ev) => {
	const payload = ev.payload as { action?: string };
	if (payload?.action === "installStatusLine") {
		const outcome = installStatusLine();
		streamDeck.ui.current?.sendToPropertyInspector({ event: "installResult", ...outcome });
	}
});

streamDeck.connect();
```

(If the SDK 2.x surface differs, adjust: the goal is "on PI `sendToPlugin` with `installStatusLine`, run `installStatusLine()` and send the result back." Verify the exact `streamDeck.ui` API against `node_modules/@elgato/streamdeck` during this task.)

- [ ] **Step 4: Show the result in the PI**

Append to `ui/session-limit.html`'s script:

```javascript
SDPIComponents.streamDeckClient.didReceiveFromPlugin?.((msg) => {
  if (msg?.event === "installResult") {
    const el = document.getElementById("setup");
    el.textContent = msg.ok ? "Done — official tracking on" : "Failed (see tooltip)";
    el.title = msg.message;
  }
});
```

- [ ] **Step 5: Build + verify the installer end-to-end**

Run: `cd plugin; npm run build; & "$env:APPDATA\npm\streamdeck.cmd" restart com.erbendriessen.claude`
Manual (on a test settings.json copy first): press "Set up official tracking" → `~/.claude/statusline.js` exists, `settings.json` has a `statusLine` entry, `settings.json.bak` created; pressing again with an existing entry does not overwrite.

- [ ] **Step 6: Commit**

```bash
git add plugin/scripts plugin/package.json plugin/.gitignore plugin/src/plugin.ts plugin/com.erbendriessen.claude.sdPlugin/ui/session-limit.html
git commit -m "Ship statusline asset + wire Set-up button to installer"
```

---

# Phase 4 — Artwork

## Task 14: Original icons + key images

**Files:**
- Replace: `plugin/com.erbendriessen.claude.sdPlugin/imgs/actions/session/icon.png` (+ `@2x`)
- Replace: `plugin/com.erbendriessen.claude.sdPlugin/imgs/actions/peak/icon.png` (+ `@2x`)
- Replace: `plugin/com.erbendriessen.claude.sdPlugin/imgs/plugin/*.png`
- Create: `plugin/assets-src/*.svg` (source SVGs)

- [ ] **Step 1: Author monochrome action-list SVGs**

Create `assets-src/session-icon.svg` — a white-stroke horseshoe glyph on transparent:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
  <circle cx="20" cy="20" r="13" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-dasharray="61 20" transform="rotate(135 20 20)"/>
</svg>
```

Create `assets-src/peak-icon.svg` — a white-stroke clock/peak glyph:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
  <circle cx="20" cy="20" r="12" fill="none" stroke="#ffffff" stroke-width="3"/>
  <path d="M20 12 V20 L26 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 2: Author the plugin marketplace mark**

Create `assets-src/plugin-icon.svg` — 256×256, a filled horseshoe gauge mark on the brand dark `#0d1117` with a teal accent (`#1d9e75`):

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="56" fill="#0d1117"/>
  <circle cx="128" cy="128" r="78" fill="none" stroke="#21262d" stroke-width="20" stroke-dasharray="367 122" transform="rotate(135 128 128)"/>
  <circle cx="128" cy="128" r="78" fill="none" stroke="#1d9e75" stroke-width="20" stroke-linecap="round" stroke-dasharray="200 490" transform="rotate(135 128 128)"/>
</svg>
```

- [ ] **Step 3: Rasterize to the required PNG sizes**

Use the bundled `sharp` (add as a dev dep: `npm i -D sharp`) via a one-off script `scripts/render-icons.mjs` that writes:
- `imgs/actions/session/icon.png` (20×20), `icon@2x.png` (40×40), `key.png` (72×72), `key@2x.png` (144×144)
- same for `peak`
- `imgs/plugin/marketplace.png` (256×256), `marketplace@2x.png` (512×512), `category-icon.png` (28×28), `category-icon@2x.png` (56×56)

```javascript
// plugin/scripts/render-icons.mjs
import sharp from "sharp";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (n) => join(root, "assets-src", n);
const out = (p) => join(root, "com.erbendriessen.claude.sdPlugin", p);
const png = (svg, size, dest) => sharp(svg).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(dest);
await Promise.all([
  png(src("session-icon.svg"), 20, out("imgs/actions/session/icon.png")),
  png(src("session-icon.svg"), 40, out("imgs/actions/session/icon@2x.png")),
  png(src("peak-icon.svg"), 20, out("imgs/actions/peak/icon.png")),
  png(src("peak-icon.svg"), 40, out("imgs/actions/peak/icon@2x.png")),
  png(src("plugin-icon.svg"), 256, out("imgs/plugin/marketplace.png")),
  png(src("plugin-icon.svg"), 512, out("imgs/plugin/marketplace@2x.png")),
  png(src("plugin-icon.svg"), 28, out("imgs/plugin/category-icon.png")),
  png(src("plugin-icon.svg"), 56, out("imgs/plugin/category-icon@2x.png")),
]);
console.log("Icons rendered.");
```

Render key state images (72/144) from a representative gauge by reusing `renderGauge` output saved to PNG, or use the plugin mark at 72/144 as a static key icon. For v1.0, render the plugin mark to `imgs/actions/<action>/key.png` (72) and `key@2x.png` (144).

- [ ] **Step 4: Run the renderer + validate**

Run: `cd plugin; node scripts/render-icons.mjs; & "$env:APPDATA\npm\streamdeck.cmd" validate com.erbendriessen.claude.sdPlugin`
Expected: "Validation successful"; action-list icons appear monochrome in the Stream Deck actions list.

- [ ] **Step 5: Commit**

```bash
git add plugin/assets-src plugin/scripts/render-icons.mjs plugin/com.erbendriessen.claude.sdPlugin/imgs plugin/package.json plugin/package-lock.json
git commit -m "Add original icons + marketplace artwork"
```

---

# Phase 5 — Package & submit

## Task 15: Manifest metadata, `.sdignore`, package

**Files:**
- Modify: `plugin/com.erbendriessen.claude.sdPlugin/manifest.json`
- Create: `plugin/com.erbendriessen.claude.sdPlugin/.sdignore`

- [ ] **Step 1: Finalise manifest metadata**

Set `"Name": "Claude Code Usage Monitor"`, `"Description": "Unofficial — not affiliated with Anthropic. Shows your Claude Code session limit and Anthropic peak hours."`, bump `"Version": "1.0.0.0"`, and set `"Category": "Claude Code Usage Monitor"`. Add a `"URL"` to the GitHub repo.

- [ ] **Step 2: Add `.sdignore`**

```
node_modules
logs
*.log
assets-src
```

(The `.sdignore` uses `.gitignore` syntax and trims the package; `bin/`, `assets/`, `imgs/`, `ui/`, and `manifest.json` must remain.)

- [ ] **Step 3: Clean build + pack**

Run (PowerShell): `cd plugin; npm run build; & "$env:APPDATA\npm\streamdeck.cmd" pack com.erbendriessen.claude.sdPlugin`
Expected: validation passes and `com.erbendriessen.claude.streamDeckPlugin` is produced.

- [ ] **Step 4: Install the packaged file as a final smoke test**

Double-click the `.streamDeckPlugin` (or `streamdeck install`), confirm both actions work from a clean install with no dev link.

- [ ] **Step 5: Commit**

```bash
git add plugin/com.erbendriessen.claude.sdPlugin/manifest.json plugin/com.erbendriessen.claude.sdPlugin/.sdignore
git commit -m "Finalise v1.0 metadata + packaging"
```

---

## Task 16: README + Marketplace submission

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

Document the new name, the customization options, the official-vs-estimate data behaviour, the Set-up button, prerequisites, and a "Privacy: reads local Claude logs only, sends nothing" note.

- [ ] **Step 2: Capture gallery screenshots**

Take 3–4 screenshots of real keys (horseshoe at low/high %, peak badge, the settings panel) for the listing.

- [ ] **Step 3: Submit via Maker Console**

Become a Maker (https://docs.elgato.com/makers/general/become-a-maker), create the product, upload the `.streamDeckPlugin` + icon + screenshots + description (state unofficial status), and submit for review.

- [ ] **Step 4: Commit + push**

```bash
git add README.md
git commit -m "Update README for v1.0 release"
git push
```

---

## Notes for the executor

- **No `Co-Authored-By` / "Generated with" trailers** in any commit.
- Prefix git/build commands with `rtk`.
- Build/pack tooling needs Node 24+ — run via PowerShell (machine PATH), since the Bash shell may cache Node 22. On-device steps need the Stream Deck app 7.1+ (installed: 7.4.2).
- SDK 2.x surface (`streamDeck.ui.onSendToPlugin`, `sendToPropertyInspector`, `onDidReceiveSettings`) and `sdpi-components` attribute names may differ slightly by version — verify against `node_modules/@elgato/streamdeck` and the sdpi-components docs during Tasks 8 and 13; the pure `lib/` modules are SDK-independent and stay as tested.
- Pure modules (`gauge`, `theme`, `settings`, `ccusage` parse, `source`, `installer` merge) are the tested core. PI HTML, installer FS side-effects, SVG appearance, packaging are verified manually.
