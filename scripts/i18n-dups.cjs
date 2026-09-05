"use strict";
const fs = require("fs");
const path = require("path");
const s = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "i18n.ts"), "utf8");
const re = /^  "((?:[^"\\]|\\.)*)":/gm;
const seen = {};
let m;
while ((m = re.exec(s))) {
  const k = m[1];
  if (!seen[k]) seen[k] = [];
  seen[k].push(s.slice(0, m.index).split("\n").length);
}
for (const [k, v] of Object.entries(seen)) {
  if (v.length > 1) console.log(JSON.stringify(k) + " @ lines " + v.join(","));
}
