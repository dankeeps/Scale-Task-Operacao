import sharp from "sharp";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "icons");
mkdirSync(outDir, { recursive: true });

// White lightning bolt (lucide "zap") centered on a black square.
// scale = fraction of the canvas the bolt occupies (smaller = more padding).
function svg(size, scale) {
  const s = size * scale;
  const off = (size - s) / 2;
  // lucide zap viewBox is 24x24
  const k = s / 24;
  const path = "M13 2 L3 14 L12 14 L11 22 L21 10 L12 10 L13 2 Z";
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="#0a0a0a"/>
      <g transform="translate(${off}, ${off}) scale(${k})">
        <path d="${path}" fill="#ffffff" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round"/>
      </g>
    </svg>`);
}

const targets = [
  { name: "icon-192.png", size: 192, scale: 0.56 },
  { name: "icon-512.png", size: 512, scale: 0.56 },
  { name: "icon-maskable-512.png", size: 512, scale: 0.44 }, // extra padding for mask safe zone
  { name: "apple-touch-icon.png", size: 180, scale: 0.56 },
];

for (const t of targets) {
  await sharp(svg(t.size, t.scale)).png().toFile(join(outDir, t.name));
  console.log("wrote", t.name);
}
console.log("done");
