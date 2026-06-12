import sharp from "sharp";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const root = dirname(fileURLToPath(import.meta.url));
mkdirSync(root, { recursive: true });
const out = (n) => join(root, n);

const BG = "#0d1117";
const ORANGE = "#d97757";
const GREEN = "#3fb950";
const YELLOW = "#d29922";
const RED = "#f85149";
const TRACK = "#21262d";
const WHITE = "#ffffff";
const MUTED = "#8b949e";

// ---- drawing helpers (all return SVG fragments) -------------------------

function horseshoe(cx, cy, r, sw, pct, colour) {
	const circ = 2 * Math.PI * r;
	const arc = circ * 0.75;
	const gap = circ - arc;
	const fill = (Math.max(0, Math.min(100, pct)) / 100) * arc;
	return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${TRACK}" stroke-width="${sw}" stroke-dasharray="${arc} ${gap}" transform="rotate(135 ${cx} ${cy})"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colour}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${fill} ${circ}" transform="rotate(135 ${cx} ${cy})"/>`;
}

function ring(cx, cy, r, sw, pct, colour) {
	const circ = 2 * Math.PI * r;
	const fill = (Math.max(0, Math.min(100, pct)) / 100) * circ;
	return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${TRACK}" stroke-width="${sw}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colour}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${fill} ${circ}" transform="rotate(-90 ${cx} ${cy})"/>`;
}

// a rounded "key" tile with a gauge + percentage
function gaugeKey(x, y, size, pct, colour, label, style = "horseshoe") {
	const cx = x + size / 2;
	const cy = y + size / 2;
	const r = size * 0.36;
	const sw = size * 0.085;
	const g = style === "ring" ? ring(cx, cy, r, sw, pct, colour) : horseshoe(cx, cy, r, sw, pct, colour);
	return `
    <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.16}" fill="#161b22"/>
    ${g}
    <text x="${cx}" y="${cy - size * 0.01}" fill="${WHITE}" font-family="sans-serif" font-size="${size * 0.26}" font-weight="600" text-anchor="middle" dominant-baseline="middle">${pct}%</text>
    <text x="${cx}" y="${cy + size * 0.2}" fill="${MUTED}" font-family="sans-serif" font-size="${size * 0.12}" text-anchor="middle" dominant-baseline="middle">${label}</text>`;
}

function badgeKey(x, y, size, isPeak, label) {
	const cx = x + size / 2;
	const colour = isPeak ? RED : GREEN;
	const text = isPeak ? "PEAK" : "OFF-PEAK";
	return `
    <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.16}" fill="#161b22"/>
    <circle cx="${cx}" cy="${y + size * 0.32}" r="${size * 0.14}" fill="${colour}"/>
    <text x="${cx}" y="${y + size * 0.62}" fill="${WHITE}" font-family="sans-serif" font-size="${size * (isPeak ? 0.19 : 0.15)}" font-weight="600" text-anchor="middle" dominant-baseline="middle">${text}</text>
    <text x="${cx}" y="${y + size * 0.82}" fill="${MUTED}" font-family="sans-serif" font-size="${size * 0.11}" text-anchor="middle" dominant-baseline="middle">${label}</text>`;
}

// the orange Claude-style spark mark
function spark(cx, cy, rInner, rOuter, sw, colour = ORANGE) {
	let lines = "";
	for (let a = 0; a < 360; a += 30) {
		lines += `<line x1="${cx}" y1="${cy - rInner}" x2="${cx}" y2="${cy - rOuter}" transform="rotate(${a} ${cx} ${cy})"/>`;
	}
	return `<g stroke="${colour}" stroke-width="${sw}" stroke-linecap="round">${lines}</g>`;
}

function frame(inner) {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="960" viewBox="0 0 1920 960">
    <rect width="1920" height="960" fill="${BG}"/>
    ${inner}
  </svg>`;
}

const title = (x, y, t, size = 84) =>
	`<text x="${x}" y="${y}" fill="${WHITE}" font-family="sans-serif" font-size="${size}" font-weight="600" dominant-baseline="middle">${t}</text>`;
const sub = (x, y, t, size = 38, fill = MUTED) =>
	`<text x="${x}" y="${y}" fill="${fill}" font-family="sans-serif" font-size="${size}" dominant-baseline="middle">${t}</text>`;

// ---- compositions -------------------------------------------------------

const thumbnail = frame(`
  <rect x="170" y="300" width="360" height="360" rx="58" fill="#161b22"/>
  ${horseshoe(350, 480, 130, 30, 42, GREEN)}
  <text x="350" y="472" fill="${WHITE}" font-family="sans-serif" font-size="92" font-weight="600" text-anchor="middle" dominant-baseline="middle">42%</text>
  <text x="350" y="548" fill="${MUTED}" font-family="sans-serif" font-size="40" text-anchor="middle" dominant-baseline="middle">2u14</text>
  ${spark(690, 360, 14, 34, 7)}
  ${title(730, 360, "Claude Code Usage Monitor", 70)}
  ${sub(730, 438, "Live Claude Code limits on your Stream Deck.", 38, "#c9d1d9")}
  ${sub(730, 494, "5h &amp; 7d windows · peak hours · customizable", 34)}
  <rect x="730" y="548" width="172" height="48" rx="24" fill="#21262d"/>
  <text x="816" y="573" fill="${MUTED}" font-family="sans-serif" font-size="26" text-anchor="middle" dominant-baseline="middle">Unofficial</text>
`);

const gallery1 = frame(`
  ${title(150, 175, "Your session limit, at a glance", 70)}
  ${sub(150, 250, "The official 5-hour and 7-day usage, with a reset countdown.", 38)}
  ${gaugeKey(220, 420, 320, 18, GREEN, "3u41")}
  ${gaugeKey(640, 420, 320, 64, YELLOW, "48m")}
  ${gaugeKey(1060, 420, 320, 92, RED, "12m")}
  ${sub(232, 800, "Green → yellow → red as you approach your limit.", 34)}
`);

const gallery2 = frame(`
  ${title(150, 175, "Peak-hour ticker", 70)}
  ${sub(150, 250, "Know when your limit drains faster — weekdays 13:00–19:00 UTC.", 38)}
  ${badgeKey(360, 410, 360, true, "ends in 1u54")}
  ${badgeKey(840, 410, 360, false, "peak in 3u06")}
  ${sub(360, 850, "A clear PEAK / OFF-PEAK badge with a countdown to the next switch.", 34)}
`);

const gallery3 = frame(`
  ${title(150, 175, "Make it yours", 70)}
  ${sub(150, 250, "Horseshoe, full ring or bar — any colour, dark, light or transparent.", 38)}
  ${gaugeKey(220, 420, 300, 55, GREEN, "horseshoe", "horseshoe")}
  ${gaugeKey(620, 420, 300, 55, ORANGE, "ring", "ring")}
  ${gaugeKey(1020, 420, 300, 55, "#8957e5", "custom colour", "horseshoe")}
  ${sub(232, 800, "Tasteful defaults out of the box; options only when you want them.", 34)}
`);

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="288" height="288" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="56" fill="${BG}"/>
  <circle cx="128" cy="128" r="90" fill="none" stroke="#2a2017" stroke-width="16" stroke-dasharray="424 142" transform="rotate(135 128 128)"/>
  <circle cx="128" cy="128" r="90" fill="none" stroke="${ORANGE}" stroke-width="16" stroke-linecap="round" stroke-dasharray="284 566" transform="rotate(135 128 128)"/>
  ${spark(128, 128, 18, 34, 9)}
</svg>`;

const jobs = [
	[thumbnail, "thumbnail.png"],
	[gallery1, "gallery-1.png"],
	[gallery2, "gallery-2.png"],
	[gallery3, "gallery-3.png"],
	[icon, "icon-288.png"],
];

await Promise.all(jobs.map(([svg, name]) => sharp(Buffer.from(svg)).png().toFile(out(name))));
console.log("Store assets rendered:", jobs.map((j) => j[1]).join(", "));
