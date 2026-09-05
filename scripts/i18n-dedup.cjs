"use strict";
// Remove duplicate DICT keys in src/lib/i18n.ts, keeping the FIRST occurrence.
const fs = require("fs");
const path = require("path");
const F = path.join(__dirname, "..", "src", "lib", "i18n.ts");
const lines = fs.readFileSync(F, "utf8").split("\n");
const seen = new Set();
const keyRe = /^  "((?:[^"\\]|\\.)*)":/;
let removed = 0;
const out = lines.filter((ln) => {
  const m = keyRe.exec(ln);
  if (!m) return true;
  if (seen.has(m[1])) {
    removed++;
    return false;
  }
  seen.add(m[1]);
  return true;
});
fs.writeFileSync(F, out.join("\n"), "utf8");
console.log(`removed=${removed}`);
