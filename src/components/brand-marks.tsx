/**
 * Inline brand marks for the developer/contact links.
 *
 * Hand-rolled SVG paths rather than an icon package: lucide has no TikTok or
 * YouTube glyph, and pulling a brand-icon dependency in for three static marks
 * is not worth the bytes. Each is a single-path silhouette on a 24x24 grid,
 * with `aria-hidden` because the adjacent link text already carries the name —
 * two announcements of the same thing is noise for a screen reader.
 */

/** Developer contact — single source for every credits block (login, sidebar, settings). */
export const DEV_NAME = "Zeidex";
export const DEV_EMAIL = "z30432981@gmail.com";
export const DEV_TIKTOK_URL = "https://www.tiktok.com/@ghost.7784";
export const DEV_YOUTUBE_URL = "https://youtube.com/@idea-784-w7d";
export const DEV_WEBSITE_URL = "https://zeidex.netlify.app/";

export function TikTokMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false" className={className}>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-1.84-2.48V9.74a5.87 5.87 0 1 0 4.93 5.8V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.29 4.29 0 0 1-3.24-1.48Z" />
    </svg>
  );
}

export function YouTubeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false" className={className}>
      <path d="M21.58 7.19a2.51 2.51 0 0 0-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42a2.51 2.51 0 0 0-1.77 1.77A26.2 26.2 0 0 0 2 12a26.2 26.2 0 0 0 .42 4.81 2.51 2.51 0 0 0 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42a2.51 2.51 0 0 0 1.77-1.77A26.2 26.2 0 0 0 22 12a26.2 26.2 0 0 0-.42-4.81ZM10 15.02V8.98L15.2 12 10 15.02Z" />
    </svg>
  );
}

export function MailMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={className}
    >
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="m3 7 8.1 5.6a1.5 1.5 0 0 0 1.8 0L21 7" />
    </svg>
  );
}
