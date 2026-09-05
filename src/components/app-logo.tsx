"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

/**
 * App logo mark — a document/archive glyph on the brand gradient.
 * Replaces the plain "أ" letter monogram used previously; scalable,
 * so the same mark can appear in the sidebar (small), login screen
 * (large) and favicon context without pixelation.
 */
export function AppLogo({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  useLang(); // re-render on language toggle
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={className}
      role="img"
      aria-label={t("شعار نظام الأرشفة الإلكترونية")}
    >
      <defs>
        <linearGradient id="app-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4338ca" />
          <stop offset="55%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="app-logo-doc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e0e7ff" />
        </linearGradient>
      </defs>

      <circle cx="256" cy="256" r="236" fill="url(#app-logo-bg)" />
      <circle
        cx="256"
        cy="256"
        r="210"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.18"
        strokeWidth="6"
      />
      <g transform="rotate(-8 256 256)">
        <rect x="146" y="96" width="220" height="320" rx="28" fill="url(#app-logo-doc)" stroke="#c7d2fe" strokeWidth="4" />
        <rect x="176" y="160" width="120" height="18" rx="9" fill="#6366f1" />
        <rect x="176" y="196" width="160" height="14" rx="7" fill="#c7d2fe" />
        <rect x="176" y="224" width="140" height="14" rx="7" fill="#c7d2fe" />
        <rect x="176" y="252" width="150" height="14" rx="7" fill="#c7d2fe" />
        <circle cx="318" cy="330" r="34" fill="#059669" />
        <path
          d="M300 330 l12 12 l24 -26"
          fill="none"
          stroke="#ffffff"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <ellipse cx="196" cy="140" rx="46" ry="26" fill="#ffffff" opacity="0.25" transform="rotate(-20 196 140)" />
    </svg>
  );
}
