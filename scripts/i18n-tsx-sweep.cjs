"use strict";
// Extract every Arabic double-quoted literal in .tsx (UI) missing from DICT,
// even when sharing a line with t()/ts(). Excludes data-ish contexts.
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "src");
const LIT = String.fromCharCode(0x0600) + "-" + String.fromCharCode(0x06ff);

function list(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "__tests__") list(p, out);
    } else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const hits = [];
for (const f of list(ROOT)) {
  const src = fs.readFileSync(f, "utf8");
  const re = new RegExp('"((?:[^"\\\\]|\\\\.)*?[' + LIT + '][^"]*?)"', "g");
  let m;
  while ((m = re.exec(src))) {
    const key = m[1].replace(/\\"/g, '"');
    const at = m.index;
    const before = src.slice(Math.max(0, at - 8), at);
    // Skip when this literal IS the first arg of t()/ts() (already covered).
    if (/(?:\btr?|ts)\(\s*(?:lang\s*,\s*)?$/.test(before)) continue;
    const line = src.slice(0, at).split("\n").length;
    hits.push({ f: path.relative(ROOT, f), line, key });
  }
}
const dict = fs.readFileSync(path.join(ROOT, "lib", "i18n.ts"), "utf8");
const miss = hits.filter((h) => !dict.includes(JSON.stringify(h.key)));
const uniq = [...new Map(miss.map((h) => [h.key, h])).values()];
fs.writeFileSync(path.join(__dirname, "i18n-tsx-missing.json"), JSON.stringify(uniq, null, 2), "utf8");
console.log(`raw-literals=${hits.length} missing=${miss.length} unique-missing=${uniq.length}`);
