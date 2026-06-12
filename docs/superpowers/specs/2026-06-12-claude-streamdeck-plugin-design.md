# Claude Stream Deck Plugin — Design

**Date:** 2026-06-12
**Status:** Approved (pending final spec review)
**Repo:** https://github.com/ErbenDriessen/Claude-Streamdeck-Plugin

## Goal

A self-built Elgato Stream Deck plugin (DIY alternative to the paid marketplace
plugins) that shows, at a glance:

1. **Session limit** — how much of the official Claude Code 5-hour rate-limit
   window is used, plus a countdown to its reset.
2. **Peak ticker** — whether we are currently in Anthropic's peak window (when
   the limit drains faster) and a countdown to the next switch.

Both actions live in **one plugin** and share the **same visual style** (a
circular ring/badge).

Cost/token tracking is explicitly **out of scope** — the user is not on
pay-as-you-go, so only the session limit matters.

## Background facts

- The official 5-hour rate-limit usage % is delivered by Claude Code **only** to
  the status line script, via stdin JSON:
  `rate_limits.five_hour.used_percentage` and `rate_limits.five_hour.resets_at`
  (Unix epoch seconds). Same for `seven_day`. These appear only on Pro/Max plans
  and only after the first API response in a session.
- A Stream Deck plugin runs **outside** Claude Code and cannot read that stdin.
  Therefore the status line must **persist** the numbers to a file the plugin can
  read.
- **Peak window** (confirmed from multiple sources, in effect since 2026-03-27):
  **Monday–Friday 13:00–19:00 UTC**. The window is **fixed** — not load-based,
  not per-country, not hour-to-hour dynamic. Only the *drain rate* changes inside
  it. Anthropic could revise the schedule in future, so it must be trivially
  editable.

## Architecture

Two decoupled parts communicating through one file.

### Part 1 — Producer (extends the existing global status line)

`~/.claude/statusline.js` (already built, already runs every ~5s while Claude
Code is open) additionally writes `~/.claude/usage.json`.

- It writes the file **only when `rate_limits` are present** in the stdin JSON.
  This means a missing/absent rate-limit reading never overwrites a good value —
  "last known good" is preserved for free.
- The write is wrapped in `try/catch`; a write failure must never break the
  status line render.

### Part 2 — Consumer (the Stream Deck plugin)

A custom plugin built with the Elgato SDK (`@elgato/cli`, Node/TypeScript) with
two actions. Each action polls/derives its data on an interval and redraws an SVG.

```
C:\dev\Claude-Streamdeck-Plugin\
  src/
    actions/session-limit.ts   # polls usage.json -> renders ring
    actions/peak-ticker.ts     # derives peak status -> renders badge
    lib/usage.ts               # read usage.json, compute state (pure, unit-tested)
    lib/peak.ts                # peak schedule + time-to-next-switch (pure, unit-tested)
    lib/render.ts              # shared SVG ring/badge renderer (pure, unit-tested)
    plugin.ts                  # registers both actions
  manifest.json                # 2 actions, UUIDs, Node 24 runtime declaration
  docs/superpowers/specs/      # this spec
```

A shared `render.ts` guarantees both buttons look identical in style.

## Data contract — `~/.claude/usage.json`

```json
{
  "schema": 1,
  "updatedAt": 1749999999,
  "fiveHour": { "usedPercentage": 43.2, "resetsAt": 1750001234 },
  "sevenDay": { "usedPercentage": 18.0, "resetsAt": 1750500000 }
}
```

- All timestamps are Unix epoch **seconds**.
- `resetsAt` is absolute, so the plugin can count down (and detect a rolled-over
  window) even while Claude Code is closed and the file is frozen.

## Behaviour

### Session-limit action

- Reads `usage.json` every few seconds.
- Renders a ring filled to `fiveHour.usedPercentage`, coloured
  **green < 70% ≤ yellow < 90% ≤ red**, the % large in the centre, and a small
  reset countdown (e.g. `2u14`) below.
- State machine (in `lib/usage.ts`):
  - **No file** → setup hint ("—" / "open Claude Code").
  - **`now > resetsAt`** → window rolled over → show `0%` / "reset" (real number
    unknown until Claude Code runs again).
  - **`now - updatedAt > 6h`** → grey/"idle" (stale; Claude Code not running).
  - **Parse error** → keep last rendered value.

### Peak-ticker action

- Schedule lives as data in `lib/peak.ts`: weekdays, `13:00–19:00 UTC`.
- Computes current status + time to the next transition, fully client-side
  (uses the machine clock, converts to UTC). No network calls.
- Renders **PEAK** (red) / **OFF-PEAK** (green) in the shared badge style, with a
  countdown to the next switch.
- The schedule constant is isolated so a future change by Anthropic is a one-line
  edit. An external refresh source is deliberately NOT included (YAGNI + avoids a
  failure mode and privacy surface); it can be added later if ever needed.

## Error handling summary

| Component | Failure | Handling |
|-----------|---------|----------|
| Producer | file write throws | swallow in try/catch; status line unaffected |
| Producer | `rate_limits` absent | skip write; preserve last good file |
| Consumer | file missing | setup hint |
| Consumer | parse error | keep last rendered value |
| Consumer | data stale (>6h) | grey/idle state |
| Consumer | window rolled over | 0%/reset state |

## Testing

- **Pure logic is unit-tested** (`lib/usage.ts`, `lib/peak.ts`, `lib/render.ts`):
  percentage→colour, epoch→countdown formatting, stale/reset/rollover state
  selection, peak/off-peak boundary cases (including the exact 13:00 and 19:00
  UTC edges and weekend behaviour).
- **SDK glue + SVG appearance** verified manually in Stream Deck via
  `npm run watch`.
- Producer change verified by piping sample JSON into `statusline.js` and
  asserting `usage.json` contents (with and without `rate_limits`).

## Phasing

1. **Producer** — extend `statusline.js` to write `usage.json`; unit/CLI test it.
   (Testable immediately, no Stream Deck needed.)
2. **Plugin** — install prerequisites, scaffold, build both actions + shared
   render, wire polling and state machines.
3. **Optional polish** — Stream Deck+ dial (encoder) support via `setFeedback`;
   theming; refined stale visuals.

## Prerequisites (for phase 2)

- **Node 24+** for the Elgato CLI/build tooling (user currently on 22.14).
- **Stream Deck app 7.1+** (free update).

## Conventions

- Commit incrementally as work progresses.
- **No `Co-Authored-By` / "Generated with" trailers** in commit messages.
