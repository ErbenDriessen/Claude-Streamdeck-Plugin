// Claude Code status line: renders the terminal line AND persists the official
// rate-limit numbers to ~/.claude/usage.json for the Stream Deck plugin.
//
// Run directly by Claude Code (stdin = session JSON). Also exports pure helpers
// for unit testing.
const fs = require("fs");
const os = require("os");
const path = require("path");

// Wrapped so the runtime call site is obvious; Date is allowed here.
function nowMs() {
  return Date.now();
}

// Maps Claude Code session JSON -> the usage.json payload, or null when the
// real rate_limits are absent (so callers never overwrite last-known-good data).
function buildUsageJson(d) {
  const rl = d && d.rate_limits;
  if (!rl || !rl.five_hour || typeof rl.five_hour.used_percentage !== "number") {
    return null;
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

function runStatusLine() {
  let raw = "";
  process.stdin.on("data", (c) => (raw += c));
  process.stdin.on("end", () => {
    let d = {};
    try {
      d = JSON.parse(raw || "{}");
    } catch {
      /* fall back to empty */
    }

    writeUsageJson(d); // persist for the Stream Deck plugin

    const c = {
      reset: "\x1b[0m",
      dim: "\x1b[2m",
      cyan: "\x1b[36m",
      green: "\x1b[32m",
      yellow: "\x1b[33m",
      red: "\x1b[31m",
      gray: "\x1b[90m",
    };
    const heat = (p) => (p >= 90 ? c.red : p >= 70 ? c.yellow : c.green);
    const bar = (p) => {
      const f = Math.round((Math.max(0, Math.min(100, p)) / 100) * 10);
      return "█".repeat(f) + "░".repeat(10 - f);
    };

    const parts = [];
    const model = d?.model?.display_name;
    if (model) parts.push(`${c.cyan}${model}${c.reset}`);

    const fiveH = d?.rate_limits?.five_hour?.used_percentage;
    if (typeof fiveH === "number") {
      parts.push(`${heat(fiveH)}5u ${bar(fiveH)} ${fiveH.toFixed(0)}%${c.reset}`);
    }

    const sevenD = d?.rate_limits?.seven_day?.used_percentage;
    if (typeof sevenD === "number") {
      parts.push(`${c.dim}7d ${sevenD.toFixed(0)}%${c.reset}`);
    }

    const ctx = d?.context_window?.used_percentage;
    if (typeof ctx === "number") {
      parts.push(`${c.gray}ctx${c.reset} ${heat(ctx)}${ctx.toFixed(0)}%${c.reset}`);
    }

    if (typeof fiveH !== "number") {
      parts.push(`${c.gray}limiet: wacht op 1e reactie${c.reset}`);
    }

    process.stdout.write(parts.join(`${c.gray} · ${c.reset}`));
  });
}

module.exports = { buildUsageJson, writeUsageJson, runStatusLine };

if (require.main === module) {
  runStatusLine();
}
