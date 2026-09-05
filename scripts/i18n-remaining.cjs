"use strict";
// Categorize remaining Arabic lines in .tsx not inside t()/ts() calls.
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "src");
const LIT = String.fromCharCode(0x0600) + "-" + String.fromCharCode(0x06ff);
const AR = new RegExp("[" + LIT + "]");

function list(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "__tests__") list(p, out);
    } else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const rows = [];
for (const f of list(ROOT)) {
  const lines = fs.readFileSync(f, "utf8").split("\n");
  lines.forEach((ln, i) => {
    if (!AR.test(ln)) return;
    if (/\bt[r]?\s*\(\s*(lang\s*,\s*)?"/.test(ln)) return; // already wrapped
    if (/^\s*(\/\/|\*|\/\*)/.test(ln)) return; // comment
    if (/console\.(log|error|warn)/.test(ln)) return; // dev log
    rows.push({ f: path.relative(ROOT, f), i: i + 1, ln: ln.trim().slice(0, 140) });
  });
}
// Group: pure JSX text (no braces) vs mixed.
const pure = rows.filter((r) => !/[{}]/.test(r.ln));
const mixed = rows.filter((r) => /[{}]/.test(r.ln));
console.log(`REMAIN total=${rows.length} pure=${pure.length} mixed=${mixed.length}`);
const byFile = {};
for (const r of rows) {
  (byFile[r.f] = byFile[r.f] || []).push(r);
}
for (const [f, rs] of Object.entries(byFile)) {
  console.log(`--- ${f} (${rs.length})`);
  for (const r of rs.slice(0, 12)) console.log(`  ${r.i}: ${r.ln}`);
}
