# Claude Stream Deck Plugin

A self-built Elgato Stream Deck plugin with two same-styled actions:

- **Session Limit** — a ring showing how much of your Claude Code **5-hour rate
  limit** is used, with a countdown to the reset. Colours green → yellow (≥70%)
  → red (≥90%).
- **Peak Ticker** — **PEAK** / **OFF-PEAK** badge plus a countdown to the next
  switch. Anthropic's peak window (when your limit drains faster) is
  **weekdays 13:00–19:00 UTC**.

## How the data flows

A Stream Deck plugin runs outside Claude Code and cannot read its rate-limit
numbers directly. So the Claude Code **status line** persists them to a file the
plugin reads:

```
Claude Code ──(status line)──▶ ~/.claude/usage.json ──(poll)──▶ Stream Deck plugin
```

`~/.claude/usage.json`:

```json
{
  "schema": 1,
  "updatedAt": 1749999999,
  "fiveHour": { "usedPercentage": 43.2, "resetsAt": 1750001234 },
  "sevenDay": { "usedPercentage": 18.0, "resetsAt": 1750500000 }
}
```

The status line writes it **only when real `rate_limits` are present**, so a
missing reading never overwrites the last known good value. Because `resetsAt` is
absolute, the plugin still counts down (and shows `reset`) even while Claude Code
is closed. Rate-limit numbers require a Pro/Max plan and appear after the first
API response in a session.

The peak window is computed **fully client-side** (no network) from the schedule
in [`plugin/src/lib/peak.ts`](plugin/src/lib/peak.ts) — edit `PEAK_SCHEDULE`
there if Anthropic ever changes it.

## Layout

```
statusline/statusline.js   # the status line producer (writes usage.json)
plugin/                    # the Stream Deck plugin
  src/lib/                 # pure, unit-tested logic (usage, peak, render)
  src/actions/             # thin SDK glue: session-limit, peak-ticker
  com.erbendriessen.claude.sdPlugin/   # manifest + icons (+ built bin/)
```

## Prerequisites

- **Node.js 24+** (Elgato build tooling).
- **Stream Deck app 7.1+** (Node-based plugins require it).
- Elgato CLI: `npm install -g @elgato/cli`.

## Install & run

1. **Producer** — copy the status line into place and reference it from
   `~/.claude/settings.json`:
   ```bash
   cp statusline/statusline.js ~/.claude/statusline.js
   ```
   ```json
   "statusLine": { "type": "command", "command": "node C:/Users/<you>/.claude/statusline.js", "refreshInterval": 5 }
   ```

2. **Plugin** — build and link:
   ```bash
   cd plugin
   npm install
   npm run build
   streamdeck link com.erbendriessen.claude.sdPlugin
   streamdeck restart com.erbendriessen.claude
   ```
   Then drag **Session Limit** and **Peak Ticker** onto keys.

   For development, `npm run watch` rebuilds and restarts the plugin on change.

## Tests

```bash
cd plugin && npm test          # plugin pure logic (Vitest)
node --test statusline/        # producer (node:test)
```
