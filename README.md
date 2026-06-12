# Claude Code Usage Monitor

> **Unofficial** — not affiliated with Anthropic.

An Elgato Stream Deck plugin that shows your **Claude Code usage limits** at a
glance, with two same-styled actions:

- **Session Limit** — a horseshoe gauge of how much of your rate-limit window is
  used (5-hour or 7-day), with a countdown to reset. Colours green → yellow → red.
- **Peak Ticker** — a PEAK / OFF-PEAK badge plus a countdown to the next switch.
  Anthropic's peak window (when your limit drains faster) is weekdays
  13:00–19:00 UTC.

## How it gets the data

The plugin reads your **local Claude Code login** and queries Anthropic's official
usage endpoint directly:

```
GET https://api.anthropic.com/api/oauth/usage
Authorization: Bearer <token from ~/.claude/.credentials.json>
anthropic-beta: oauth-2025-04-20
```

This is the same call Claude Code itself makes. It is **live and works whether or
not a Claude Code terminal is open**, and returns both the 5-hour and 7-day
windows (`utilization` + `resets_at`).

**Privacy:** your token never leaves your machine except to Anthropic's own API.
The plugin sends nothing anywhere else. If the token is missing or expired (it is
refreshed whenever Claude Code runs), the plugin falls back to a local
`~/.claude/usage.json` if present, otherwise shows a setup hint.

## Customization (per key, in the Property Inspector)

Sensible defaults out of the box; options only when you want them.

- Window: 5-hour / 7-day
- Gauge style: horseshoe / full ring / bar
- Countdown on/off
- Colour: auto heat or a single accent colour
- Background: dark / light
- Advanced: yellow/red thresholds; peak window UTC hours

## Build & run (development)

Prerequisites: **Node 24+**, **Stream Deck app 7.1+**, and the Elgato CLI
(`npm install -g @elgato/cli`).

```bash
cd plugin
npm install
npm run build
streamdeck link com.erbendriessen.claude.sdPlugin
streamdeck restart com.erbendriessen.claude
```

`npm run watch` rebuilds on change. `node scripts/render-icons.mjs` regenerates the
PNG icons from `assets-src/`.

## Tests

```bash
cd plugin && npm test          # plugin logic (Vitest)
node --test ../statusline/     # the optional status line producer
```

## Package

```bash
cd plugin
streamdeck pack com.erbendriessen.claude.sdPlugin
```

produces `com.erbendriessen.claude.streamDeckPlugin` for install or Marketplace
submission.

## Repository layout

```
plugin/                     # the Stream Deck plugin
  src/lib/                  # pure, unit-tested logic (gauge, theme, source, usageApi, ...)
  src/actions/              # session-limit, peak-ticker
  assets-src/               # icon source SVGs
  com.erbendriessen.claude.sdPlugin/   # manifest, icons, UI, built bin/
statusline/                 # optional standalone Claude Code status line (offline fallback)
docs/superpowers/           # design specs + implementation plans
```
