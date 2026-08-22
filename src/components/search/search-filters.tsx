import { Filter } from "lucide-react";
import { cn, STATUS_META } from "@/lib/format";
import type { DeptOption, TagOption } from "./search-types";

export interface SearchFiltersProps {
  docTypes: string[];
  departments: DeptOption[];
  tags: TagOption[];
  statuses: string[];
  selectedTypes: string[];
  selectedDepts: number[];
  selectedTags: number[];
  selectedStatuses: string[];
  dateFrom: string;
  dateTo: string;
  onToggleType: (t: string) => void;
  onToggleDept: (id: number) => void;
  onToggleTag: (id: number) => void;
  onToggleStatus: (s: string) => void;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onClearAll: () => void;
}

export function SearchFilters({
  docTypes,
  departments,
  tags,
  statuses,
  selectedTypes,
  selectedDepts,
  selectedTags,
  selectedStatuses,
  dateFrom,
  dateTo,
  onToggleType,
  onToggleDept,
  onToggleTag,
  onToggleStatus,
  onDateFromChange,
  onDateToChange,
  onClearAll,
}: SearchFiltersProps) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm shadow-slate-950/[0.03] ring-1 ring-inset ring-primary/5">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-bold text-foreground">
          <Filter className="h-3.5 w-3.5 text-primary" /> خيارات البحث المتقدم
        </span>
        <button type="button" onClick={onClearAll} className="text-xs text-rose-500 hover:text-rose-400">
          إزالة الكل
        </button>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {/* Doc types */}
        <div>
          <label className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-semibold text-muted-foreground">
            <span>نوع المستند</span>
            {selectedTypes.length > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 py-px text-[9px] font-bold text-primary ring-1 ring-inset ring-primary/20">
                {selectedTypes.length}
              </span>
            )}
          </label>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-lg bg-muted/60 p-2">
            {docTypes.map((t) => {
              const active = selectedTypes.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onToggleType(t)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-all duration-150",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20 ring-primary/30"
                      : "text-muted-foreground ring-transparent hover:bg-background hover:ring-border/60"
                  )}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        {/* Departments */}
        <div>
          <label className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-semibold text-muted-foreground">
            <span>القسم</span>
            {selectedDepts.length > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 py-px text-[9px] font-bold text-primary ring-1 ring-inset ring-primary/20">
                {selectedDepts.length}
              </span>
            )}
          </label>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-muted/60 p-2">
            {departments.map((d) => {
              const active = selectedDepts.includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onToggleDept(d.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-start transition-colors duration-150",
                    active
                      ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/15"
                      : "text-muted-foreground hover:bg-background/60"
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-primary" : "bg-muted-foreground/30")} />
                  {d.name}
                </button>
              );
            })}
            {departments.length === 0 && <span className="text-[10px] text-muted-foreground">جارٍ التحميل...</span>}
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-semibold text-muted-foreground">
            <span>الوسم</span>
            {selectedTags.length > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 py-px text-[9px] font-bold text-primary ring-1 ring-inset ring-primary/20">
                {selectedTags.length}
              </span>
            )}
          </label>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-muted/60 p-2">
            {tags.map((t) => {
              const active = selectedTags.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onToggleTag(t.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-start transition-colors duration-150",
                    active
                      ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/15"
                      : "text-muted-foreground hover:bg-background/60"
                  )}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: active ? undefined : t.color }}
                  />
                  {t.name}
                </button>
              );
            })}
            {tags.length === 0 && <span className="text-[10px] text-muted-foreground">جارٍ التحميل...</span>}
          </div>
        </div>

        {/* Status + dates */}
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-semibold text-muted-foreground">
              <span>الحالة</span>
              {selectedStatuses.length > 0 && (
                <span className="rounded-full bg-primary/10 px-1.5 py-px text-[9px] font-bold text-primary ring-1 ring-inset ring-primary/20">
                  {selectedStatuses.length}
                </span>
              )}
            </label>
            <div className="flex flex-wrap gap-1.5 rounded-lg bg-muted/60 p-2">
              {statuses.map((s) => {
                const active = selectedStatuses.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onToggleStatus(s)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-all duration-150",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20 ring-primary/30"
                        : "text-muted-foreground ring-transparent hover:bg-background hover:ring-border/60"
                    )}
                  >
                    {STATUS_META[s]?.label || s}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">نطاق التاريخ</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                className="w-full rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground outline-none transition-all duration-150 hover:border-primary/25 focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              />
              <span className="self-center text-[10px] text-muted-foreground">إلى</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                className="w-full rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground outline-none transition-all duration-150 hover:border-primary/25 focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
