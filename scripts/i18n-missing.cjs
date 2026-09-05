"use strict";
/* List every t()/ts() key used in src that has no DICT entry.
 * Run: node scripts/i18n-missing.cjs
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "src");

function list(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "__tests__") list(p, out);
    } else if (/\.(tsx|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

const used = new Map(); // key -> [files]
for (const f of list(ROOT)) {
  const src = fs.readFileSync(f, "utf8");
  const re = /(?:\btr?|ts)\(\s*(?:lang\s*,\s*)?"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(src))) {
    const key = m[1].replace(/\\"/g, '"');
    if (!/[\u0600-\u06FF]/.test(key)) continue;
    if (!used.has(key)) used.set(key, []);
    used.get(key).push(path.relative(ROOT, f));
  }
}

const i18n = fs.readFileSync(path.join(ROOT, "lib", "i18n.ts"), "utf8");
const missing = [...used.keys()].filter((k) => !i18n.includes(`"${k}"`));
fs.writeFileSync(
  path.join(__dirname, "i18n-newkeys.json"),
  JSON.stringify(missing, null, 2),
  "utf8"
);
console.log(`used=${used.size} missing=${missing.length}`);
// Show keys that look like code (likely bad wraps) for review.
const codey = missing.filter((k) => /[;=\[\]]|=>|\?\?|const |return |import /.test(k));
console.log(`CODEY=${codey.length}`);
codey.slice(0, 20).forEach((k) => console.log(`  CODEY: ${k.slice(0, 120)}`));
