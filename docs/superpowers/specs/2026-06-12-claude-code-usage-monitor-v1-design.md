# Claude Code Usage Monitor — v1.0 (release) Design

**Date:** 2026-06-12
**Status:** Approved (pending final spec review)
**Repo:** https://github.com/ErbenDriessen/Claude-Streamdeck-Plugin
**Supersedes the visuals/scope of:** `2026-06-12-claude-streamdeck-plugin-design.md` (the working prototype)

## Goal

Turn the working prototype into the cleanest, most professional Claude-usage
plugin on the Elgato Marketplace — one that feels first-party. Ship two
same-styled actions, full-but-tasteful visual customization, original artwork,
and a self-contained data path, then package and submit for Marketplace review.

**Display name:** "Claude Code Usage Monitor".
**Branding:** Unofficial. The description must state "Unofficial — not affiliated
with Anthropic." Internal UUID stays `com.erbendriessen.claude`.

## Non-goals (YAGNI for v1.0)

- Stream Deck+ dial / encoder support (candidate for v1.1).
- Cost / dollar display (the user does not use pay-as-you-go).
- Localised Property Inspector (English only for v1.0).

## Two actions

1. **Session Limit** (`com.erbendriessen.claude.session`) — a horseshoe gauge of
   the chosen rate-limit window's used %, with a reset countdown.
2. **Peak Ticker** (`com.erbendriessen.claude.peak`) — a PEAK / OFF-PEAK badge in
   the same style, with a countdown to the next switch. Peak window is the fixed
   weekday 13:00–19:00 UTC schedule (client-side, editable constant).

## Visual design

### Horseshoe gauge (replaces the full ring)

A 270° arc, open at the bottom, that fills from the lower-left, over the top, to
the lower-right. Rendered as an SVG circle with `stroke-dasharray` and a 135°
rotation so the gap sits centred at the bottom:

- Track: `stroke-dasharray "245 81.7"`, `transform rotate(135 72 72)`, colour
  `#21262d`.
- Fill: `stroke-dasharray "<fillLen> 326.7"` where `fillLen = pct/100 * 245`,
  same rotation, round linecap, heat colour.
- Centre: `%` (large), reset countdown below.
- Geometry constants live in `lib/gauge.ts` as pure, tested functions
  (`dashFor(pct)` etc.), independent of the SVG string.

### Gauge styles (user-selectable)

`horseshoe` (default), `ring` (full 360° from 12 o'clock — the prototype look),
`bar` (a flat horizontal fill). All three share the same centre text and colour
logic; only the track/fill geometry differs.

### Colour

- Heat mode (default): green `#3fb950` < yellow threshold ≤ `#d29922` < red
  threshold ≤ `#f85149`.
- Solid mode: a single user-chosen accent colour regardless of %.
- Key background: dark `#0d1117` (default) or light `#f6f8fa`, with text colours
  flipping accordingly.

## Customization (Property Inspector)

The PI is the make-or-break for "clean, not overwhelming." Rules:

- **Sensible defaults** so a fresh drop-on-key looks great with zero config.
- Grouped into a few labelled sections; advanced options live in a collapsed
  "Advanced" disclosure, not in the user's face.
- Each control maps to a persisted action setting (`setSettings`/`getSettings`).

### Session Limit settings

| Section | Control | Setting key | Default |
|---------|---------|-------------|---------|
| Display | Window: 5-hour / 7-day | `window` | `fiveHour` |
| Display | Show reset countdown | `showCountdown` | `true` |
| Display | Gauge style: horseshoe / ring / bar | `gaugeStyle` | `horseshoe` |
| Colour | Mode: auto heat / solid | `colourMode` | `heat` |
| Colour | Accent (solid mode only) | `accent` | `#3fb950` |
| Colour | Key background: dark / light | `background` | `dark` |
| Advanced | Yellow threshold % | `warnAt` | `70` |
| Advanced | Red threshold % | `dangerAt` | `90` |
| Setup | "Set up official tracking" button | — | — |

### Peak Ticker settings

| Section | Control | Setting key | Default |
|---------|---------|-------------|---------|
| Display | Show countdown | `showCountdown` | `true` |
| Colour | Key background: dark / light | `background` | `dark` |
| Advanced | Peak start hour (UTC) | `peakStartUTC` | `13` |
| Advanced | Peak end hour (UTC) | `peakEndUTC` | `19` |

## Data source (Session Limit)

A Stream Deck plugin cannot read Claude Code's rate-limit numbers directly — they
are only delivered to the Claude Code status line. The official % is our key
differentiator, so the plugin both **uses** and can **set up** that path.

### Resolution priority (`lib/source.ts`, pure where possible)

1. **`~/.claude/usage.json`** — written by our status line. If present and fresh
   (`updatedAt` within 6h), use it → the real Anthropic %. This is preferred.
2. **`ccusage` fallback** — if the file is missing/stale, spawn
   `npx ccusage@latest blocks --active --json` and use the active 5-hour block.
   ccusage cannot produce the official plan %, so in fallback mode the gauge shows
   **window progress** (block elapsed / 300 min) and the block's real reset
   countdown, with a small "≈" marker and a tooltip explaining it is an estimate
   until official tracking is set up.
3. **Neither** → setup state ("—", prompts the user to press Set up).

### "Set up official tracking" (one-time, from the PI)

A button in the Session Limit PI that:

1. Writes `~/.claude/statusline.js` (our producer; bundled with the plugin under
   `assets/statusline.js`).
2. Reads `~/.claude/settings.json`, backs it up to `settings.json.bak`, merges in
   a `statusLine` entry (`{ type: "command", command: "node <abs path>",
   refreshInterval: 5 }`) **only if one is not already present**, and writes it
   back. If a `statusLine` already exists, it does not overwrite it — instead it
   reports that and shows manual instructions.
3. Reports success/failure back to the PI.

This is done by the plugin's Node backend (it has normal filesystem access), not
the sandboxed PI. All writes are wrapped and reversible (the `.bak`).

## Producer (`statusline.js`)

Unchanged in behaviour from the prototype (writes `usage.json` only when real
`rate_limits` are present). It now lives in two places kept in sync:
`statusline/statusline.js` (source of truth + tests) is copied to
`plugin/com.erbendriessen.claude.sdPlugin/assets/statusline.js` at build time by a
small `prebuild` script, so the installer button ships the current version.

## Icons & store assets (release requirement)

Replace all Elgato placeholders with original artwork:

- **Action-list icons** (`imgs/actions/<action>/icon`): monochrome, white stroke
  (`#FFFFFF`) on transparent, per Marketplace rules. Session = a horseshoe-gauge
  glyph; Peak = a clock/peak glyph. 20×20 (40×40 @2x), SVG.
- **Key state images** (`imgs/actions/<action>/key`): a neutral representative
  render (the live SVG replaces it at runtime). 72×72 (144×144 @2x).
- **Plugin / category / marketplace icons**: original mark, 256×256 (512×512 @2x).
- **Gallery screenshots** for the listing: produced from real keys after build.

## Code structure

```
plugin/src/
  lib/
    usage.ts      # usage.json read + session state machine (existing, pure)
    ccusage.ts    # spawn + parse ccusage active block (new)
    source.ts     # resolution priority usage.json -> ccusage -> setup (new)
    peak.ts       # peak schedule + next switch (existing, pure)
    gauge.ts      # pure geometry: dash/bar math per gauge style (new)
    render.ts     # SVG builders for horseshoe/ring/bar + badge (extended)
    theme.ts      # colour/threshold/background resolution from settings (new)
    settings.ts   # setting types + defaults for both actions (new)
    installer.ts  # status-line install/patch logic (new; FS side-effects isolated)
  actions/
    session-limit.ts  # reads settings, resolves source, renders (extended)
    peak-ticker.ts    # reads settings, renders (extended)
  plugin.ts
  ui/
    session-limit.html # Property Inspector (new)
    peak-ticker.html   # Property Inspector (new)
```

Pure modules (`usage`, `ccusage` parse, `peak`, `gauge`, `theme`, `settings`,
`source` decision) are unit-tested. SDK glue, PI HTML, installer side-effects, and
SVG appearance are verified manually in Stream Deck.

## Error handling

| Component | Failure | Handling |
|-----------|---------|----------|
| source | usage.json missing/stale | fall through to ccusage |
| source | ccusage not installed / errors / times out | setup state, no crash |
| installer | settings.json unreadable / locked | report error to PI, write nothing |
| installer | statusLine already configured | do not overwrite; show manual steps |
| render | unknown gaugeStyle in settings | default to horseshoe |
| actions | any draw throws | log, keep last image, never exit |

## Testing

- Unit (Vitest): gauge geometry per style and at 0/partial/100%; theme resolution
  (heat thresholds incl. exact boundaries, solid mode, light/dark); settings
  defaults + merge; ccusage JSON parsing (valid, empty, malformed); source
  priority (fresh file wins, stale → ccusage, none → setup).
- Producer (node:test): `buildUsageJson` (existing) stays green.
- Manual: PI controls persist and redraw live; installer writes + backup +
  no-overwrite path; all three gauge styles and both backgrounds on a real key;
  `streamdeck validate` and `streamdeck pack` succeed.

## Release steps

1. `streamdeck pack com.erbendriessen.claude.sdPlugin` → `.streamDeckPlugin`
   (with a `.sdignore` excluding `node_modules`, sources, logs).
2. Become a Maker (Maker Console).
3. Upload the package + metadata + gallery screenshots; description states the
   unofficial status.
4. Submit for review; address any change requests.

## Phasing

1. **Visual core** — `gauge.ts` + `theme.ts` + `render.ts` (3 styles + badge),
   fully tested; wire into existing actions with hard-coded defaults.
2. **Settings + PI** — `settings.ts`, both Property Inspectors, actions read
   settings.
3. **Data source** — `ccusage.ts` + `source.ts` fallback; `installer.ts` + the
   Set-up button; `prebuild` copy of `statusline.js` into `assets/`.
4. **Artwork** — original icons + marketplace assets.
5. **Package & submit** — `.sdignore`, pack, Maker Console.

## Conventions

- Commit incrementally; **no `Co-Authored-By` / "Generated with" trailers**.
- Prefix git/build commands with `rtk`.
- Build tooling needs Node 24+ (run via PowerShell machine PATH); Stream Deck app
  7.1+ for on-device testing.
