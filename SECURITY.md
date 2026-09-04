# Security Policy — EDMS

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.x     | ✅        |

## Reporting a vulnerability

Open a **private** security advisory on GitHub (Security → Advisories) or contact the
maintainers. Please include steps to reproduce, impacted routes, and any logs.
Do **not** open public issues for vulnerabilities. Aim to respond within 7 days.

## Final audit (v1.0.0, 2026-09-04) — summary

| Area | Result |
| ---- | ------ |
| Authentication | HMAC-SHA256 signed `edms_uid` cookie (`httpOnly`, `SameSite=Strict`); fail-fast without `AUTH_SECRET`; no default secret |
| Brute force | In-memory guard: 8 failures / account / 10 min (`src/lib/login-throttle.ts`); failures-only counting |
| Password pastes | `sanitizePastedPassword` strips RTL/whitespace copy artifacts before verification |
| Authorization | RBAC + per-document checks on every API route and page; covered by `critical-guards` tests |
| SQL injection | All user input via drizzle parameterized templates; LIKE wildcards escaped (`sanitizeLikeQuery` + `ESCAPE '\'`) |
| XSS | No `dangerouslySetInnerHTML` in app code; mermaid runs `securityLevel: "strict"` + DOMPurify re-sanitize; SVG/Office forced to download |
| File serving | `resolveKey` rejects path traversal; per-type `Content-Disposition`/CSP; RBAC + audit on every view/download |
| Uploads | Extension allowlist, 50 MB cap, server-derived MIME (never trust `file.type`) |
| Secrets in repo | Verified: no passwords, tokens, API keys, or personal data tracked (`.env`, `data/`, `storage/`, logs ignored) |
| npm audit | 3 transitive advisories (js-yaml, nanoid, mermaid) — **not reachable** with attacker input (no direct use; mermaid input is developer-authored + sanitized). Run `npm audit fix` when the registry is reachable; CI `security-scan` tracks regressions |

## Deployment notes

- Single-process only (SQLite file DB): run **one** Node process; the login throttle is in-memory by design.
- Serve behind TLS (Nginx/Caddy). The demo cookie uses `secure: false` for plain-HTTP
  development — set it to `true` when terminating TLS (see `src/lib/session.ts`).
- Back up `data/edms.db` + `storage/` with the server stopped.
