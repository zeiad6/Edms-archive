import type { Document } from "@/db/schema";

/**
 * Document enriched with department and uploader display names
 */
export type EnrichedDocument = Document & {
  departmentName: string | null;
  departmentColor: string | null;
  uploaderName: string | null;
};

/**
 * Calculates the count of documents with a specific status
 * @param statusRows - Array of status rows from database query
 * @param status - The status to count (e.g., "active", "pending_review")
 * @returns The count of documents with the specified status
 */
export function getStatusCount(
  statusRows: { status: string; c: number }[],
  status: string
): number {
  return statusRows.find((r) => r.status === status)?.c ?? 0;
}

/**
 * Generates month date labels for the last 6 months
 * @returns Array of month objects with label and start date
 */
export function generateMonthDates(): { label: string; start: string }[] {
  const months: { label: string; start: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    months.push({
      label: new Intl.DateTimeFormat("ar-EG", { month: "short", year: "numeric" }).format(d),
      start: `${y}-${m}-01`,
    });
  }
  return months;
}

/**
 * Calculates monthly trend data for the dashboard
 * @param monthlyRaw - Raw monthly counts from database
 * @returns Object containing months array and monthly maximum value
 */
export function calculateMonthlyTrend(
  monthlyRaw: number[]
): { months: { label: string; start: string }[]; monthlyMax: number } {
  const months: { label: string; start: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    months.push({
      label: new Intl.DateTimeFormat("ar-EG", { month: "short", year: "numeric" }).format(d),
      start: `${y}-${m}-01`,
    });
  }
  const monthlyMax = Math.max(1, ...monthlyRaw);
  return { months, monthlyMax };
}

/**
 * Calculates status segments for the dashboard visualization
 * @param statusRows - Array of status rows from database query
 * @param total - Total number of documents
 * @returns Array of status segments with counts and percentages
 */
export function calculateStatusSegments(
  statusRows: { status: string; c: number }[],
  total: number
): Array<{
  s: string;
  c: number;
  pct: number;
  color: string;
}> {
  const statusCount = (s: string) => getStatusCount(statusRows, s);
  return (["active", "pending_review", "archived", "draft"] as const).map((s) => ({
    s,
    c: statusCount(s),
    pct: total ? (statusCount(s) / total) * 100 : 0,
    color: { active: "#10b981", pending_review: "#f59e0b", archived: "#3b82f6", draft: "#94a3b8" }[s],
  }));
}

/**
 * Generates greeting based on current time
 * @returns Greeting string in Arabic
 */
export function getGreeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "صباح الخير" : hour < 18 ? "مساء الخير" : "مساء الخير";
}

/**
 * Formats today's date in Arabic
 * @returns Formatted date string
 */
export function getTodayFormatted(): string {
  return new Intl.DateTimeFormat("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date());
}

/**
 * Prepares recent documents for display
 * @param recentRaw - Raw document rows from database
 * @param user - Current user object
 * @param canAccessFn - Function to check document access
 * @returns Filtered and processed documents with department/uploader names
 */
export function prepareRecentDocuments<T>(
  recentRaw: Array<{
    d: Document;
    deptName: string | null;
    deptColor: string | null;
    uploaderName: string | null;
  }>,
  user: T | null,
  canAccessFn: (user: T | null, doc: Document) => boolean
): EnrichedDocument[] {
  return recentRaw
    .map((r) => ({
      ...r.d,
      departmentName: r.deptName,
      departmentColor: r.deptColor,
      uploaderName: r.uploaderName,
    }))
    .filter((d) => canAccessFn(user, d))
    .slice(0, 7);
}