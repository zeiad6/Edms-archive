"use strict";
/*
 * Generate the app icons from public/icon.svg (the app's own logo — no
 * external/Electron branding):
 *   resources/icon/icon-16.png, icon-32.png, icon-48.png, icon-128.png,
 *   icon-256.png, icon-512.png  (RGBA, transparent background)
 *   resources/icon/icon.ico        (multi-size Windows icon, from PNGs)
 *
 * Uses sharp (already a runtime dependency) — no pngquant needed; sharp's
 * lossless PNG encoder + palette quantization gets the same size win.
 */
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const svg = path.join(root, "public", "icon.svg");
const outDir = path.join(root, "resources", "icon");

const SIZES = [16, 32, 48, 128, 256, 512];

/*
 * Build a compact Windows .ico containing PNG-compressed entries (Vista+).
 * NSIS rejects oversized icon files, so only <=256px entries are embedded
 * (that is also the practical Windows display ceiling).
 * ICO layout: 6-byte header + 16-byte directory entries + PNG blobs.
 */
async function buildIco(pngBuffers) {
  const entries = pngBuffers.filter((b) => b.size <= 256);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + 16 * entries.length;
  entries.forEach((e, i) => {
    const d = i * 16;
    dir[d] = e.size === 256 ? 0 : e.size; // width byte (0 == 256)
    dir[d + 1] = e.size === 256 ? 0 : e.size; // height byte
    dir[d + 2] = 0; // palette
    dir[d + 3] = 0; // reserved
    dir.writeUInt16LE(1, d + 4); // planes
    dir.writeUInt16LE(32, d + 6); // bpp
    dir.writeUInt32LE(e.buf.length, d + 8); // blob size
    dir.writeUInt32LE(offset, d + 12); // blob offset
    offset += e.buf.length;
  });

  return Buffer.concat([header, dir, ...entries.map((e) => e.buf)]);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const pngs = [];
  const icoPngs = [];
  for (const size of SIZES) {
    const out = path.join(outDir, `icon-${size}.png`);
    const buf = await sharp(svg)
      .resize(size, size)
      .png({ palette: size <= 48, compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
    fs.writeFileSync(out, buf);
    const kb = Math.round(buf.length / 1024);
    console.log(`  icon-${size}.png (${kb} KB)`);
    pngs.push(out);
    icoPngs.push({ size, buf });
  }

  const ico = await buildIco(icoPngs);
  fs.writeFileSync(path.join(outDir, "icon.ico"), ico);
  console.log(`  icon.ico (${Math.round(ico.length / 1024)} KB)`);
  console.log("Icons OK.");
}

main().catch((e) => {
  console.error("icon generation failed:", e);
  process.exit(1);
});
