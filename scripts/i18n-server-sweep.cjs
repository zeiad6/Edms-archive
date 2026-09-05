"use strict";
/* Extract Arabic string literals from server .ts files (actions/api/lib)
 * that lack DICT entries — these surface in the UI via t(err) wrappers.
 * Run: node scripts/i18n-server-sweep.cjs
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const ROOTS = ["src/actions", "src/app/api", "src/lib"].map((d) => path.join(ROOT, d));

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.ts$/.test(e.name) && !/__tests__/.test(p) && !p.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

const out = [];
const LIT = String.fromCharCode(0x0600) + "-" + String.fromCharCode(0x06ff);
for (const f of walk(ROOT).filter((p) => ROOTS.some((r) => p.startsWith(r)))) {
  const src = fs.readFileSync(f, "utf8");
  const re = new RegExp('"((?:[^"\\\\]|\\\\.)*?[' + LIT + '][^"]*?)"', "g");
  let m;
  while ((m = re.exec(src))) {
    const v = m[1];
    if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|WITH)\b/i.test(v.trim())) continue;
    out.push(v);
  }
}
const u = [...new Set(out)];
const dict = fs.readFileSync(path.join(ROOT, "src", "lib", "i18n.ts"), "utf8");
const miss = u.filter((k) => !dict.includes(JSON.stringify(k)));
fs.writeFileSync(path.join(__dirname, "i18n-server-missing.json"), JSON.stringify(miss, null, 2), "utf8");
console.log(`used=${u.length} missing=${miss.length}`);
