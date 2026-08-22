"use client";

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
  /** Parsed timestamp — a real Date so AG Grid's date filter and sorting work reliably. */
  time: Date;
  user: string | null;
  action: string;
  details: string | null;
}

/** Static column definitions — module scope so AG Grid keeps stable identity across renders. */
const BASE_COLUMNS: ColDef<AuditRow>[] = [
    {
      headerName: "التاريخ والوقت",
      field: "time",
      minWidth: 180,
      filter: "agDateColumnFilter",
      sort: "desc",
      valueFormatter: (p: any) => (p.value ? formatDateTime(p.value) : "—"),
      cellClass: "text-muted-foreground",
    },
    {
      headerName: "المستخدم",
      field: "user",
      minWidth: 130,
      filter: "agSetColumnFilter",
      cellRenderer: (p: any) =>
        p.value ? (
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-foreground">
              {p.value.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
            </span>
            <span className="font-medium text-foreground">{p.value}</span>
          </div>
        ) : (
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/50">
              <Settings className="h-3 w-3" />
            </span>
            النظام
          </span>
        ),
    },
    {
      headerName: "العملية",
      field: "action",
      minWidth: 130,
      filter: "agSetColumnFilter",
      cellRenderer: (p: any) => {
        const m = ACTION_META[p.value];
        return (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${m?.tone ?? "bg-muted text-muted-foreground"}`}
          >
            {m?.icon ?? <Tag className="h-3 w-3" />}
            {m?.label ?? p.value}
          </span>
        );
      },
    },
    {
      headerName: "التفاصيل",
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

export function AuditGrid({ rows }: { rows: AuditRow[] }) {
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
      result = result.filter((r) => (r.user ?? "").toLowerCase().includes(q) || (r.details ?? "").toLowerCase().includes(q));
    }
    if (dateFrom) {
      const fromT = localDay(dateFrom).getTime();
      result = result.filter((r) => r.time.getTime() >= fromT);
    }
    if (dateTo) {
      const toT = localDay(dateTo).getTime() + 86_400_000; // end of day
      result = result.filter((r) => r.time.getTime() <= toT);
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

  const columnDefs = useMemo<ColDef<AuditRow>[]>(() => BASE_COLUMNS, []);

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
          <span>
            إجمالي: <strong className="text-foreground">{stats.total}</strong>
          </span>
          <span>
            مستخدمون: <strong className="text-foreground">{stats.users}</strong>
          </span>
          <span>
            أنواع عمليات: <strong className="text-foreground">{stats.actions}</strong>
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground">
          آخر تحديث: {formatDateTime(new Date().toISOString())}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Action-type chips — only types present in the data, most frequent first */}
        <button
          onClick={() => setActionFilter(null)}
          className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
            !actionFilter ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          الكل
        </button>
        {availableActions.map((key) => {
          const m = ACTION_META[key];
          return (
            <button
              key={key}
              onClick={() => setActionFilter(actionFilter === key ? null : key)}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium transition ${
                actionFilter === key
                  ? `${m?.tone ?? "bg-primary text-primary-foreground"} shadow-sm ring-1 ring-border`
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {m?.icon ?? <Tag className="h-3 w-3" />}
              {m?.label ?? key}
            </button>
          );
        })}

        {/* Date range filter */}
        <div className="ms-auto flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1">
            <span className="text-muted-foreground">من</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-7 rounded-md border border-border bg-card px-2 text-xs text-foreground outline-none transition focus:border-primary/40"
            />
          </label>
          <label className="flex items-center gap-1">
            <span className="text-muted-foreground">إلى</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-7 rounded-md border border-border bg-card px-2 text-xs text-foreground outline-none transition focus:border-primary/40"
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
        <div className="flex items-center gap-1">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={textSearch}
            onChange={(e) => setTextSearch(e.target.value)}
            placeholder="بحث في المستخدم أو التفاصيل…"
            className="h-8 w-44 rounded-lg border border-border bg-card px-3 text-xs text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
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
