import sharp from "sharp";
import pngToIco from "png-to-ico";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "..", "public");

const svg = await fs.readFile(path.join(publicDir, "logo.svg"));

const pngSizes = [
  { file: "favicon-16x16.png", size: 16 },
  { file: "favicon-32x32.png", size: 32 },
  { file: "apple-touch-icon.png", size: 180 },
  { file: "android-chrome-192x192.png", size: 192 },
  { file: "android-chrome-512x512.png", size: 512 },
];

for (const { file, size } of pngSizes) {
  const out = path.join(publicDir, file);
  await sharp(svg).resize(size, size).png().toFile(out);
  console.log(`Generado: ${file}`);
}

// favicon.ico con 16+32+48
const buffers = await Promise.all(
  [16, 32, 48].map((size) => sharp(svg).resize(size, size).png().toBuffer()),
);
const icoBuffer = await pngToIco(buffers);
await fs.writeFile(path.join(publicDir, "favicon.ico"), icoBuffer);
console.log("Generado: favicon.ico");
