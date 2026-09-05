"use strict";
/* One-shot codemod: wrap Arabic UI literals in .tsx files with t()/ts().
 * - Client ("use client") files: t("..."), + useLang() subscription.
 * - Server files: ts(lang, "...") + getServerLang() (single-line signatures).
 * - Collects every newly wrapped key into i18n-report.json for translation.
 * - IDEMPOTENT-ish: skips strings already inside t()/ts() and reruns safely.
 * Run: node scripts/i18n-wrap.cjs [--apply]
 * Default is dry-run (report only).
 */
const fs = require("fs");
const path = require("path");

const APPLY = process.argv.includes("--apply");
const ROOT = path.resolve(__dirname, "..", "src");
const AR = /[\u0600-\u06FF]/;

const SKIP_DIRS = ["__tests__"];
const SKIP_FILES = new Set([
  "seed.ts", "doc-svg.ts", "edms-diagrams.ts",
  "documents-page-client.tsx", // already fully wrapped manually
]);

// Insert import lines after the top import block (multi-line-import aware:
// consumes continuation lines until braces/parens balance out).
function insertAfterImports(src, lines) {
  const srcLines = src.split("\n");
  let i = 0;
  // Skip a leading "use client" directive first — imports go below it.
  if (i < srcLines.length && /^\s*["']use client["']\s*;?\s*$/.test(srcLines[i])) i++;
  while (i < srcLines.length && /^\s*(\/\/.*)?\s*$/.test(srcLines[i])) i++;
  let lastImport = -1;
  let j = i;
  let inImport = false;
  let depth = 0;
  while (j < srcLines.length) {
    const ln = srcLines[j];
    if (!inImport) {
      if (/^\s*import\b/.test(ln)) {
        inImport = true;
        depth =
          (ln.match(/\{/g) || []).length - (ln.match(/\}/g) || []).length +
          (ln.match(/\(/g) || []).length - (ln.match(/\)/g) || []).length;
        if (depth <= 0 && /;\s*$/.test(ln)) {
          lastImport = j;
          inImport = false;
        } else if (depth <= 0 && /from\s*["'][^"']+["']\s*$/.test(ln)) {
          lastImport = j;
          inImport = false;
        }
      } else if (/^\s*$/.test(ln) || /^\s*\/\//.test(ln)) {
        // blank/comment between imports — keep scanning
      } else {
        break;
      }
    } else {
      depth +=
        ((ln.match(/\{/g) || []).length - (ln.match(/\}/g) || []).length +
          (ln.match(/\(/g) || []).length - (ln.match(/\)/g) || []).length);
      if (depth <= 0) {
        lastImport = j;
        inImport = false;
      }
    }
    j++;
  }
  const insertAt = lastImport >= 0 ? lastImport + 1 : i;
  srcLines.splice(insertAt, 0, ...lines);
  return srcLines.join("\n");
}

function listTsx(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.includes(e.name)) listTsx(p, out);
    } else if (e.name.endsWith(".tsx") && !SKIP_FILES.has(e.name)) {
      out.push(p);
    }
  }
  return out;
}

// Decode JSX entities so wrapped keys match the runtime string exactly
// (inside {t("...")} there is no JSX decoding anymore).
function dec(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

// Mask <pre>...</pre> blocks (whitespace-sensitive) before JSX-text transform.
function maskPre(src) {
  const pres = [];
  const masked = src.replace(/<pre[\s\S]*?<\/pre>/g, (m) => {
    pres.push(m);
    return `\u0000PRE${pres.length - 1}\u0000`;
  });
  return { masked, pres };
}
function unmask(src, pres) {
  return src.replace(/\u0000PRE(\d+)\u0000/g, (_, i) => pres[Number(i)]);
}

// Walk from `from` to the first `{` at paren/bracket depth 0 (skips string
// literals). Returns its index, or -1.
function bodyOpenFrom(src, from) {
  let paren = 0;
  let bracket = 0;
  let q = null;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === "\\") i++;
      else if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") q = c;
    else if (c === "(") paren++;
    else if (c === ")") paren = Math.max(0, paren - 1);
    else if (c === "[") bracket++;
    else if (c === "]") bracket = Math.max(0, bracket - 1);
    else if (c === "{") {
      if (paren === 0 && bracket === 0) return i;
    } else if (c === ";" && paren === 0) return -1;
  }
  return -1;
}

// First exported PascalCase component (function or arrow) body brace.
function findBodyOpen(src) {
  const fn = /(?:^|\n)\s*export\s+(?:default\s+)?function\s+[A-Z][\w$]*/.exec(src);
  if (fn) {
    const at = bodyOpenFrom(src, fn.index + fn[0].length);
    if (at >= 0) return at;
  }
  const ar = /(?:^|\n)\s*export\s+const\s+[A-Z][\w$]*\s*=/.exec(src);
  if (ar) {
    const arrow = /=>/.exec(src.slice(ar.index));
    if (arrow) {
      const at = bodyOpenFrom(src, ar.index + arrow.index + 2);
      if (at >= 0) {
        // `=> expr` without braces is not a block body.
        const between = src.slice(ar.index + arrow.index + 2, at).trim();
        if (between === "") return at;
      }
    }
  }
  return -1;
}

function processFile(file) {
  let src = fs.readFileSync(file, "utf8");
  const orig = src;
  if (!AR.test(src)) return null;
  const isClient = src.includes('"use client"') || importedByClient.has(file);
  // Local `t` identifier conflict (e.g. .map((t) => ... {t.name}))?
  const conflict = /map\(\(\s*t\b|\{\s*t\s*\./.test(src);
  const T = conflict ? "tr" : "t";
  const report = [];
  const addKey = (key) => {
    if (!report.includes(key)) report.push(key);
  };

  const { masked, pres } = maskPre(src);
  src = masked;

  // Code-looking content must never be treated as JSX text: real text nodes
  // contain no ;=[]?&| and no JS operators/keywords.
  const CODEY = /;|\[|\]|=|\?|&|\||=>|\?\?|\?\.\s*["']|&&|\|\||\b(const|let|var|return|import|from|new|typeof|useState|useRef|useEffect|useMemo|useCallback)\b/;
  // Attribute matches inside JS (param defaults, objects) are preceded by
  // , ( = : ? ; — real JSX props follow a tag name, another prop, or {.
  function isJsContext(src, idx) {
    let j = idx - 1;
    while (j >= 0 && /\s/.test(src[j])) j--;
    return j >= 0 && /[,(:=?;]/.test(src[j]);
  }
  if (isClient) {
    // 1) JSX text: >text< (no nested tags/braces/code) -> >{t("text")}<
    src = src.replace(/>([^<>{}]*?[\u0600-\u06FF][^<>{}]*?)</g, (m, inner) => {
      if (/^\s*$/.test(inner)) return m;
      if (CODEY.test(inner)) return m;
      const key = dec(inner.replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ")).replace(/"/g, '\\"');
      if (!key) return m;
      addKey(key.replace(/\\"/g, '"'));
      return `>{${T}("${key}")}<`;
    });
    // 2) String attributes -> {t("...")} (JSX only, never param defaults)
    src = src.replace(
      /((?:placeholder|aria-label|aria-description|title|alt))\s*=\s*"([^"]*?[\u0600-\u06FF][^"]*?)"/g,
      (m, attr, val, off) => {
        if (isJsContext(src, off)) return m;
        const key = val.replace(/"/g, '\\"');
        addKey(val);
        return `${attr}={${T}("${key}")}`;
      }
    );
    // 3) toast.*("...") / throw new Error("...") with Arabic
    src = src.replace(
      /((?:toast\.(?:success|error|info|warning|message)|throw new Error|new Error)\()\s*"((?:[^"\\\n]|\\.)*?[\u0600-\u06FF][^"\n]*?)"/g,
      (m, head, val) => {
        if (new RegExp(`\\b${T}\\s*\\(`).test(src.slice(Math.max(0, src.indexOf(m) - 4), src.indexOf(m)))) return m;
        addKey(val.replace(/\\"/g, '"'));
        return `${head}${T}("${val}")`;
      }
    );
    // 4) catch displays: `e instanceof Error ? e.message :` -> t(e.message)
    src = src.replace(/(\be\s+instanceof\s+Error\s*\?\s*)e\.message(\s*:)/g, `$1${T}(e.message)$2`);
  } else {
    // Server: same but ts(lang, ...)
    src = src.replace(/>([^<>{}]*?[\u0600-\u06FF][^<>{}]*?)</g, (m, inner) => {
      if (/^\s*$/.test(inner)) return m;
      if (CODEY.test(inner)) return m;
      const key = dec(inner.replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ")).replace(/"/g, '\\"');
      if (!key) return m;
      addKey(key.replace(/\\"/g, '"'));
      return `>{ts(lang, "${key}")}<`;
    });
    src = src.replace(
      /((?:placeholder|aria-label|aria-description|title|alt))\s*=\s*"([^"]*?[\u0600-\u06FF][^"]*?)"/g,
      (m, attr, val, off) => {
        if (isJsContext(src, off)) return m;
        const key = val.replace(/"/g, '\\"');
        addKey(val);
        return `${attr}={ts(lang, "${key}")}`;
      }
    );
  }

  src = unmask(src, pres);

  const notes = [];
  // Imports (useLang lives in lang-provider, t in lib/i18n)
  if (isClient) {
    if (!/from\s+["']@\/lib\/i18n["']/.test(src)) {
      src = insertAfterImports(src, [
        `import { ${T === "t" ? "t" : "t as tr"} } from "@/lib/i18n";`,
        `import { useLang } from "@/components/lang-provider";`,
      ]);
      notes.push("import-added");
    } else if (!/\buseLang\b/.test(src)) {
      // useLang lives in lang-provider — add a separate import.
      src = insertAfterImports(src, [`import { useLang } from "@/components/lang-provider";`]);
      notes.push("useLang-import-added");
    }
    // useLang() subscription after the component body's opening brace
    // (brace-walk: handles multiline signatures and arrow components).
    if (!/\buseLang\(\)/.test(src)) {
      const at = findBodyOpen(src);
      if (at >= 0) {
        src = src.slice(0, at + 1) + `\n  useLang(); // re-render on language toggle` + src.slice(at + 1);
        notes.push("useLang-added");
      } else {
        notes.push("NEEDS-MANUAL-useLang");
      }
    }
  } else {
    if (!/from\s+["']@\/lib\/i18n["']/.test(src)) {
      src = insertAfterImports(src, [
        `import { ts } from "@/lib/i18n";`,
        `import { getServerLang } from "@/lib/server-lang";`,
      ]);
      notes.push("import-added");
    }
    if (!/getServerLang\(\)/.test(src)) {
      const m = /^[ \t]*export\s+(?:default\s+)?(?:async\s+)?function\s+[A-Z][\w$]*/m.exec(src);
      if (m) {
        const fnKw = src.indexOf("function", m.index);
        const at = bodyOpenFrom(src, m.index + m[0].length);
        if (fnKw >= 0 && at >= 0) {
          const hasAsync = /\basync\b/.test(src.slice(m.index, fnKw));
          src =
            src.slice(0, fnKw) +
            (hasAsync ? "" : "async ") +
            src.slice(fnKw, at + 1) +
            `\n  const lang = await getServerLang();` +
            src.slice(at + 1);
          notes.push("server-lang-added");
        } else {
          notes.push("NEEDS-MANUAL-server-lang");
        }
      } else {
        notes.push("NEEDS-MANUAL-server-lang");
      }
    }
  }

  return { file, isClient, T, report, notes, out: src, changed: src !== orig };
}

const files = listTsx(ROOT);

// A file without "use client" is still client code when imported by a client
// file (e.g. presentational pieces used inside client forms). Wrapping those
// with ts(lang,...) would crash (next/headers in the browser), so detect
// direct importers and treat them as client.
const bodies = new Map();
for (const f of files) bodies.set(f, fs.readFileSync(f, "utf8"));
// Fixpoint: client = has directive OR imported (directly) by a client file.
const clientSet = new Set(
  [...bodies.entries()].filter(([, b]) => b.includes('"use client"')).map(([f]) => f)
);
let grew = true;
while (grew) {
  grew = false;
  for (const f of files) {
    if (clientSet.has(f)) continue;
    const base = path.basename(f, ".tsx");
    const alt = base === "index" ? `|${path.basename(path.dirname(f))}` : "";
    const re = new RegExp(`from\\s*["'][^"']*\\/(?:${base}${alt})["']|from\\s*["']\\.\\.?\\/[^"']*(?:${base}${alt})["']`);
    for (const cf of clientSet) {
      if (re.test(bodies.get(cf))) {
        clientSet.add(f);
        grew = true;
        break;
      }
    }
  }
}
const importedByClient = clientSet;

const results = [];
for (const f of files) {
  try {
    const r = processFile(f);
    if (r && (r.changed || r.report.length > 0 || r.notes.some((n) => n.startsWith("NEEDS")))) results.push(r);
  } catch (e) {
    results.push({ file: f, error: String(e), report: [], notes: [] });
  }
}

if (APPLY) {
  for (const r of results) {
    if (!r.error) fs.writeFileSync(r.file, r.out, "utf8");
  }
}
const summary = results.map((r) => ({
  file: path.relative(ROOT, r.file),
  client: r.isClient,
  T: r.T,
  notes: r.notes,
  newKeys: r.report,
  error: r.error,
}));
fs.writeFileSync(path.join(__dirname, "i18n-report.json"), JSON.stringify(summary, null, 2), "utf8");
const keyCount = summary.reduce((a, s) => a + s.newKeys.length, 0);
console.log(`files-touched=${summary.length} new-keys=${keyCount} apply=${APPLY}`);
for (const s of summary) {
  if (s.notes.some((n) => n.startsWith("NEEDS")) || s.error) {
    console.log(`MANUAL ${s.file}: ${s.notes.join(",")} ${s.error || ""}`);
  }
}
