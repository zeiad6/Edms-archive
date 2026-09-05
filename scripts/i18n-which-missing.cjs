"use strict";
// Show file:line for t()/ts() keys missing from DICT.
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

const LIT = String.fromCharCode(0x0600) + "-" + String.fromCharCode(0x06ff);
const dict = fs.readFileSync(path.join(ROOT, "lib", "i18n.ts"), "utf8");
for (const f of list(ROOT)) {
  const src = fs.readFileSync(f, "utf8");
  const re = new RegExp("(?:\\btr?|ts)\\(\\s*(?:lang\\s*,\\s*)?\"((?:[^\"\\\\]|\\\\.)*)\"", "g");
  let m;
  while ((m = re.exec(src))) {
    const key = m[1].replace(/\\"/g, '"');
    const hasAr = new RegExp("[" + LIT + "]").test(key);
    if (!hasAr) continue;
    if (!dict.includes(JSON.stringify(key))) {
      const line = src.slice(0, m.index).split("\n").length;
      console.log(path.relative(ROOT, f) + ":" + line + " :: " + key.slice(0, 80));
    }
  }
}
console.log("done");
