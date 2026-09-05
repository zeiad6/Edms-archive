"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useState, useMemo } from "react";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "@/components/data-grid";
import { formatDateTime } from "@/lib/format";
import {
  Search,
  X,
  Upload,
  ScanLine,
  Eye,
  Download,
  Pencil,
  RefreshCw,
  Trash2,
  Layers,
  LogIn,
  LogOut,
  Building2,
  FolderClosed,
  UserPlus,
  UserCog,
  UserMinus,
  Tag,
  Clock,
  CheckCircle2,
  Pen,
  Settings,
} from "lucide-react";

const ACTION_META: Record<string, { label: string; tone: string; icon: React.ReactNode }> = {
  "document.upload": { label: "إيداع مستند", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", icon: <Upload className="h-3 w-3" /> },
  "document.scan": { label: "مسح ضوئي", tone: "bg-violet-500/10 text-violet-700 dark:text-violet-400", icon: <ScanLine className="h-3 w-3" /> },
  "document.view": { label: "عرض مستند", tone: "bg-slate-500/10 text-slate-600 dark:text-slate-300", icon: <Eye className="h-3 w-3" /> },
  "document.download": { label: "تنزيل مستند", tone: "bg-sky-500/10 text-sky-700 dark:text-sky-400", icon: <Download className="h-3 w-3" /> },
  "document.search": { label: "بحث", tone: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400", icon: <Search className="h-3 w-3" /> },
  "document.update": { label: "تحديث بيانات", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400", icon: <Pencil className="h-3 w-3" /> },
  "document.status": { label: "تغيير حالة", tone: "bg-teal-500/10 text-teal-700 dark:text-teal-400", icon: <RefreshCw className="h-3 w-3" /> },
  "document.delete": { label: "حذف مستند", tone: "bg-rose-500/10 text-rose-700 dark:text-rose-400", icon: <Trash2 className="h-3 w-3" /> },
  "document.version": { label: "إصدار جديد", tone: "bg-blue-500/10 text-blue-700 dark:text-blue-400", icon: <Layers className="h-3 w-3" /> },
  "document.version.download": { label: "تنزيل إصدار", tone: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400", icon: <Download className="h-3 w-3" /> },
  "auth.login": { label: "تسجيل دخول", tone: "bg-slate-500/10 text-slate-600 dark:text-slate-300", icon: <LogIn className="h-3 w-3" /> },
  "auth.logout": { label: "تسجيل خروج", tone: "bg-slate-500/10 text-slate-600 dark:text-slate-300", icon: <LogOut className="h-3 w-3" /> },
  "department.create": { label: "إنشاء قسم", tone: "bg-teal-500/10 text-teal-700 dark:text-teal-400", icon: <Building2 className="h-3 w-3" /> },
  "folder.create": { label: "إنشاء مجلد", tone: "bg-teal-500/10 text-teal-700 dark:text-teal-400", icon: <FolderClosed className="h-3 w-3" /> },
  "user.create": { label: "إضافة مستخدم", tone: "bg-teal-500/10 text-teal-700 dark:text-teal-400", icon: <UserPlus className="h-3 w-3" /> },
  "user.update": { label: "تحديث مستخدم", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400", icon: <UserCog className="h-3 w-3" /> },
  "user.delete": { label: "حذف مستخدم", tone: "bg-rose-500/10 text-rose-700 dark:text-rose-400", icon: <UserMinus className="h-3 w-3" /> },
  "tag.create": { label: "إنشاء وسم", tone: "bg-purple-500/10 text-purple-700 dark:text-purple-400", icon: <Tag className="h-3 w-3" /> },
  "approval.request": { label: "طلب موافقة", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400", icon: <Clock className="h-3 w-3" /> },
  "approval.respond": { label: "رد على موافقة", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", icon: <CheckCircle2 className="h-3 w-3" /> },
  "signature.add": { label: "توقيع إلكتروني", tone: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400", icon: <Pen className="h-3 w-3" /> },
  "settings.update": { label: "تحديث إعدادات", tone: "bg-slate-500/10 text-slate-600 dark:text-slate-300", icon: <Settings className="h-3 w-3" /> },
};

export interface AuditRow {
  id: number;
  /**
   * Parsed timestamp — normally a real Date from the server, but RSC
   * serialization may deliver it as an ISO string on the client, so every
   * consumer must go through `timeMs()` instead of calling `getTime()` directly.
   */
  time: Date | string;
  user: string | null;
  action: string;
  details: string | null;
}

/** Safe timestamp accessor — never throws/NaN: corrupt values fall back to epoch (0). */
function timeMs(v: AuditRow["time"]): number {
  try {
    const d = v instanceof Date ? v : new Date(v as string);
    const m = d.getTime();
    return Number.isNaN(m) ? 0 : m;
  } catch {
    return 0;
  }
}

/** Column definitions rebuilt when the language toggles (headers + labels). */
function buildColumns(): ColDef<AuditRow>[] {
  return [
    {
      headerName: t("التاريخ والوقت"),
      field: "time",
      minWidth: 180,
      filter: "agDateColumnFilter",
      sort: "desc",
      // Normalize to a real Date so AG Grid's date filter + sorting work even
      // when RSC serialization delivered `time` as an ISO string.
      valueGetter: (p: any) => {
        const v = p.data?.time;
        if (v instanceof Date) return v;
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? new Date(0) : d;
      },
      valueFormatter: (p: any) => (p.value ? formatDateTime(p.value) : "—"),
      cellClass: "text-muted-foreground",
    },
    {
      headerName: t("المستخدم"),
      field: "user",
      minWidth: 130,
      filter: "agSetColumnFilter",
      cellRenderer: (p: any) =>
        p.value ? (
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-foreground shadow-sm ring-1 ring-inset ring-border/50">
              {p.value.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
            </span>
            <span className="font-medium text-foreground">{p.value}</span>
          </div>
        ) : (
          <span className="flex items-center gap-2.5 text-muted-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/50 shadow-sm ring-1 ring-inset ring-border/50">
              <Settings className="h-3 w-3" />
            </span>{t("النظام")}</span>
        ),
    },
    {
      headerName: t("العملية"),
      field: "action",
      minWidth: 130,
      filter: "agSetColumnFilter",
      cellRenderer: (p: any) => {
        const m = ACTION_META[p.value];
        return (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm ring-1 ring-inset ring-black/[0.05] dark:ring-white/10 ${m?.tone ?? "bg-muted text-muted-foreground"}`}
          >
            {m?.icon ?? <Tag className="h-3 w-3" />}
            {m?.label ? t(m.label) : p.value}
          </span>
        );
      },
    },
    {
      headerName: t("التفاصيل"),
      field: "details",
      flex: 1.5,
      minWidth: 260,
      cellRenderer: (p: any) =>
        p.value ? (
          <span className="block w-full cursor-help text-foreground" title={p.value}>
            {p.value.length > 120 ? `${p.value.slice(0, 120)}...` : p.value}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];
}

export function AuditGrid({ rows }: { rows: AuditRow[] }) {
  const { lang } = useLang(); // re-render on language toggle
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [textSearch, setTextSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  /** Action chips reflect what actually exists in the data — never stale/empty types. */
  const availableActions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.action, (counts.get(r.action) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([action]) => action);
  }, [rows]);

  // <input type="date"> gives "YYYY-MM-DD" — parse as LOCAL midnight so day
  // boundaries match the rows' local timestamps (UTC parsing would silently
  // exclude the first hours of the day in positive-offset timezones).
  const localDay = (isoDay: string) => new Date(`${isoDay}T00:00:00`);

  const filtered = useMemo(() => {
    let result = rows;
    if (actionFilter) {
      result = result.filter((r) => r.action === actionFilter);
    }
    if (textSearch.trim()) {
      const q = textSearch.trim().toLowerCase();
      result = result.filter(
        (r) =>
          (r.user ?? "").toLowerCase().includes(q) ||
          (r.details ?? "").toLowerCase().includes(q) ||
          (r.action ?? "").toLowerCase().includes(q),
      );
    }
    if (dateFrom) {
      const fromT = localDay(dateFrom).getTime();
      if (!Number.isNaN(fromT)) result = result.filter((r) => timeMs(r.time) >= fromT);
    }
    if (dateTo) {
      const dayT = localDay(dateTo).getTime();
      if (!Number.isNaN(dayT)) result = result.filter((r) => timeMs(r.time) <= dayT + 86_400_000); // end of day
    }
    return result;
  }, [rows, actionFilter, textSearch, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const uniqueUsers = new Set(filtered.map((r) => r.user ?? "النظام"));
    const byAction: Record<string, number> = {};
    for (const r of filtered) {
      byAction[r.action] = (byAction[r.action] ?? 0) + 1;
    }
    return { total: filtered.length, users: uniqueUsers.size, actions: Object.keys(byAction).length };
  }, [filtered]);

  const columnDefs = useMemo<ColDef<AuditRow>[]>(() => buildColumns(), [lang]);

  return (
    <div className="page-stack">
      {/* Stats bar */}
      <div className="section-card card-sheen flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 !py-3.5 text-xs">
        <div className="toolbar !gap-x-5 !gap-y-2 text-muted-foreground">
          <span>{t("إجمالي:")}<strong className="text-foreground">{stats.total}</strong>
          </span>
          <span>{t("مستخدمون:")}<strong className="text-foreground">{stats.users}</strong>
          </span>
          <span>{t("أنواع عمليات:")}<strong className="text-foreground">{stats.actions}</strong>
          </span>
        </div>
        <div className="tnum text-[11px] text-muted-foreground">
          {t("آخر تحديث:")} {formatDateTime(new Date().toISOString())}
        </div>
      </div>

      {/* Filters */}
      <div className="toolbar">
        {/* Action-type chips — only types present in the data, most frequent first */}
        <button
          onClick={() => setActionFilter(null)}
          className={`rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-sm ring-1 ring-inset ring-border/50 transition hover:shadow ${
            !actionFilter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >{t("الكل")}</button>
        {availableActions.map((key) => {
          const m = ACTION_META[key];
          return (
            <button
              key={key}
              onClick={() => setActionFilter(actionFilter === key ? null : key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-sm ring-1 ring-inset ring-border/50 transition hover:shadow ${
                actionFilter === key
                  ? `${m?.tone ?? "bg-primary text-primary-foreground"} ring-border`
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {m?.icon ?? <Tag className="h-3 w-3" />}
              {m?.label ? t(m.label) : key}
            </button>
          );
        })}

        {/* Date range filter */}
        <div className="filter-bar ms-auto !gap-2.5 text-xs">
          <label className="flex items-center gap-1.5">
            <span className="text-muted-foreground">{t("من")}</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 rounded-xl border border-border bg-card px-2.5 text-xs text-foreground shadow-sm outline-none transition hover:border-primary/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-muted-foreground">{t("إلى")}</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 rounded-xl border border-border bg-card px-2.5 text-xs text-foreground shadow-sm outline-none transition hover:border-primary/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
          </label>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Text search */}
        <div className="flex items-center gap-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={textSearch}
            onChange={(e) => setTextSearch(e.target.value)}
            placeholder={t("بحث في المستخدم أو التفاصيل…")}
            className="h-9 w-44 rounded-xl border border-border bg-card px-3.5 text-xs text-foreground shadow-sm outline-none transition hover:border-primary/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 sm:w-52"
          />
          {textSearch && (
            <button onClick={() => setTextSearch("")} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <DataGrid rows={filtered} columnDefs={columnDefs} getRowId={(p) => `a-${p.data.id}`} exportName="audit-log" height="max(620px, calc(100vh - 420px))" />
    </div>
  );
}
