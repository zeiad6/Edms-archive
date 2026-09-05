"use strict";
/* Repair: move i18n/lang-provider imports below the "use client" directive.
 * Run: node scripts/i18n-fix-directive.cjs [--apply]
 */
const fs = require("fs");
const path = require("path");
const APPLY = process.argv.includes("--apply");
const ROOT = path.resolve(__dirname, "..", "src");

function listTsx(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "__tests__") listTsx(p, out);
    } else if (e.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

let fixed = 0;
for (const f of listTsx(ROOT)) {
  const src = fs.readFileSync(f, "utf8");
  const lines = src.split("\n");
  const dirIdx = lines.findIndex((l) => /^\s*["']use client["']\s*;?\s*$/.test(l));
  if (dirIdx <= 0) continue;
  // Import lines above the directive that belong below it.
  const move = [];
  const keep = [];
  lines.forEach((l, i) => {
    if (i < dirIdx && /from\s+["']@\/lib\/i18n["']|from\s+["']@\/components\/lang-provider["']/.test(l)) {
      move.push(l);
    } else {
      keep.push(l);
    }
  });
  if (move.length === 0) continue;
  const newDirIdx = keep.findIndex((l) => /^\s*["']use client["']\s*;?\s*$/.test(l));
  keep.splice(newDirIdx + 1, 0, ...move);
  if (APPLY) fs.writeFileSync(f, keep.join("\n"), "utf8");
  fixed++;
  console.log(`fix ${path.relative(ROOT, f)}`);
}
console.log(`fixed=${fixed} apply=${APPLY}`);
