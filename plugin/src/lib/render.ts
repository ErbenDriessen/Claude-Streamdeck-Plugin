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
  const r = 56;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
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
