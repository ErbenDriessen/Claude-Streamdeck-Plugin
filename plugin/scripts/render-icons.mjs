import sharp from "sharp";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (n) => join(root, "assets-src", n);
const out = (p) => join(root, "com.erbendriessen.claude.sdPlugin", p);

const png = (svg, size, dest) =>
  sharp(svg, { density: 384 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(dest);

const plugin = src("plugin-icon.svg");
const sessionGlyph = src("session-icon.svg");
const peakGlyph = src("peak-icon.svg");

await Promise.all([
  // Action-list icons (monochrome white glyph)
  png(sessionGlyph, 20, out("imgs/actions/session/icon.png")),
  png(sessionGlyph, 40, out("imgs/actions/session/icon@2x.png")),
  png(peakGlyph, 20, out("imgs/actions/peak/icon.png")),
  png(peakGlyph, 40, out("imgs/actions/peak/icon@2x.png")),
  // Key default state images (the live SVG replaces these at runtime)
  png(plugin, 72, out("imgs/actions/session/key.png")),
  png(plugin, 144, out("imgs/actions/session/key@2x.png")),
  png(plugin, 72, out("imgs/actions/peak/key.png")),
  png(plugin, 144, out("imgs/actions/peak/key@2x.png")),
  // Plugin / marketplace / category icons
  png(plugin, 256, out("imgs/plugin/marketplace.png")),
  png(plugin, 512, out("imgs/plugin/marketplace@2x.png")),
  png(sessionGlyph, 28, out("imgs/plugin/category-icon.png")),
  png(sessionGlyph, 56, out("imgs/plugin/category-icon@2x.png")),
]);

console.log("Icons rendered.");
