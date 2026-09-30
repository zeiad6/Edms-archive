import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

// Bundle analysis is opt-in via `ANALYZE=true next build` (native Turbopack
// support). When disabled (the default), the config passes through untouched
// so the standard Turbopack production build is not affected.
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: process.cwd(),
  },
  // Keep the standalone payload lean: runtime data dirs (created at boot via
  // EDMS_* env vars) and packaging artifacts must never be traced into the
  // build output, or dist/ re-includes itself across packaging runs.
  outputFileTracingExcludes: {
    "*": [
      "./dist/**",
      "./data/**",
      "./storage/**",
      "./logs/**",
      "./graphify-out/**",
      "./resources/**",
      "./scripts/**",
      "./electron/**",
      "./src/**",
      "./node_modules/electron/**",
      "./node_modules/electron-builder/**",
      "./node_modules/javascript-obfuscator/**",
      "./node_modules/png-to-ico/**",
      "./node_modules/@next/bundle-analyzer/**",
      "./node_modules/eslint/**",
      "./node_modules/typescript/**",
      "./node_modules/vitest/**",
      "./node_modules/@types/**",
      "./node_modules/@eslint/**",
      "./node_modules/eslint-*/**",
      "./node_modules/@vitest/**",
      "./node_modules/@testing-library/**",
    ],
  },
  // أصول الـ dev مسموح بها من المتغير ALLOWED_DEV_ORIGINS (مفصولة بفواصل) — ليست IP ثابت
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS?.split(",") ?? [],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // X-XSS-Protection was removed: it is deprecated, every current
          // browser ignores it, and Chrome/Firefox actively warn on it. The
          // CSP below plus the absence of any reflected-input sink is what
          // actually prevents XSS here.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // TODO: picks up 'unsafe-inline' only for Next.js inline styles/scripts. Replace with per-request nonce (headers `script-src 'nonce-...'` + generate in middleware) then drop 'unsafe-inline'. Never re-add 'unsafe-eval'.
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
