// Pure, client-safe formatting & UI helpers.

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 ب";
  const units = ["ب", "ك.ب", "م.ب", "غ.ب"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

const arDate = new Intl.DateTimeFormat("ar-EG", {
  year: "numeric",
  month: "long",
  day: "numeric",
});
const arDateTime = new Intl.DateTimeFormat("ar-EG", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  try {
    return arDate.format(new Date(value));
  } catch {
    // invalid date string — safe fallback
    return "—";
  }
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  try {
    return arDateTime.format(new Date(value));
  } catch {
    // invalid date string — safe fallback
    return "—";
  }
}

export function timeAgo(value: string | Date): string {
  const diff = Date.now() - new Date(value).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "الآن";
  const min = Math.floor(sec / 60);
  if (min < 60) return `قبل ${min} دقيقة`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `قبل ${hr} ساعة`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `قبل ${day} يوم`;
  return formatDate(value);
}

// ---- Domain metadata (dark-aware) -----------------------------------------

export const STATUS_META: Record<
  string,
  { label: string; badge: string; dot: string }
> = {
  active: { label: "ساري", badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/20", dot: "bg-emerald-500" },
  pending_review: { label: "قيد المراجعة", badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-500/20", dot: "bg-amber-500" },
  draft: { label: "مسودة", badge: "bg-slate-500/10 text-slate-600 dark:text-slate-300 ring-1 ring-inset ring-slate-500/20", dot: "bg-slate-400" },
  archived: { label: "مؤرشف", badge: "bg-blue-500/10 text-blue-700 dark:text-blue-400 ring-1 ring-inset ring-blue-500/20", dot: "bg-blue-500" },
};

export const ROLE_META: Record<string, { label: string; badge: string }> = {
  admin: { label: "مدير النظام", badge: "bg-violet-500/10 text-violet-700 dark:text-violet-400 ring-1 ring-inset ring-violet-500/20" },
  manager: { label: "مشرف قسم", badge: "bg-sky-500/10 text-sky-700 dark:text-sky-400 ring-1 ring-inset ring-sky-500/20" },
  staff: { label: "موظف", badge: "bg-slate-500/10 text-slate-600 dark:text-slate-300 ring-1 ring-inset ring-slate-500/20" },
};

// Helper: convert hex color → inline style for a type/department badge.
// Preserved for backward compat with StatusBadge etc.
export function docTypeStyle(hex: string | null | undefined): { backgroundColor: string; color: string } {
  const h = hex || "#64748b";
  return { backgroundColor: h + "18", color: h };
}

/** @deprecated Use DB-driven `docTypes.color` + `docTypeStyle()` instead */
export const DOC_TYPE_META: Record<string, string> = {
  "قرار إداري": "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  "عقد": "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  "مراسلة رسمية": "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  "فاتورة": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "تقرير": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "محضر اجتماع": "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
  "نموذج": "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  "صورة ضوئية": "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  "أخرى": "bg-slate-500/10 text-slate-500 dark:text-slate-400",
};

export function extFromName(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

export function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    bmp: "image/bmp",
    tif: "image/tiff",
    tiff: "image/tiff",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    csv: "text/csv",
    rtf: "application/rtf",
  };
  return map[ext.toLowerCase()] || "application/octet-stream";
}

export function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}

/** Images the browser renders natively in <img> (TIFF excluded — no browser support). */
export function isBrowserImage(mime: string, ext?: string | null): boolean {
  if (!isImage(mime)) return false;
  const e = (ext || "").toLowerCase();
  if (e === "tif" || e === "tiff" || mime === "image/tiff") return false;
  return true;
}

export function isPdf(mime: string): boolean {
  return mime === "application/pdf";
}

/** Plain-text formats we render inline as <pre> (fetched client-side). */
export function isTextPreviewable(mime: string, ext?: string | null): boolean {
  const e = (ext || "").toLowerCase();
  if (["txt", "csv"].includes(e)) return true;
  return mime === "text/plain" || mime === "text/csv";
}

const OFFICE_EXTS = new Set(["doc", "docx", "xls", "xlsx", "ppt", "pptx", "rtf"]);

/** Office formats with no native browser renderer — download-only with guidance. */
export function isOfficeOnly(ext?: string | null): boolean {
  return OFFICE_EXTS.has((ext || "").toLowerCase());
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] || "") + (parts[1][0] || "");
}

/**
 * Escape SQL LIKE wildcards so user input matches literally.
 * Wraps the input in %...% and escapes %, _, and the escape char itself.
 * MUST be paired with `ESCAPE '\'` in the query, e.g.:
 *   sql`${documents.title} LIKE ${sanitizeLikeQuery(q)} ESCAPE '\\'`
 */
export function sanitizeLikeQuery(input: string): string {
  const escaped = input
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
  return `%${escaped}%`;
}
