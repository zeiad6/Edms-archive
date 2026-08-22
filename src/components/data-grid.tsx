"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ColDef, GridApi, GridReadyEvent } from "ag-grid-community";
import { Search, Download, Table2, Loader2 } from "lucide-react";
import { toast } from "sonner";

// AG Grid (~700KB) is lazy-loaded into its own chunk so it never blocks the
// initial render of pages that use data grids.
const AgGrid = dynamic(() => import("./ag-grid-client"), {
  ssr: false,
});

export interface DataGridProps {
  rows: any[];
  columnDefs: ColDef[];
  defaultColDef?: ColDef;
  getRowId?: (params: { data: any }) => string;
  exportName?: string;
  /** Grid height: px number, or a CSS length (e.g. "max(580px, calc(100vh - 360px))") for viewport-responsive sizing. */
  height?: number | string;
  quickFilterPlaceholder?: string;
  /** Enable checkbox row selection (AG Grid multiple mode) */
  rowSelection?: "multiple";
  /** Fired whenever row selection changes — receives array of selected row data */
  onSelectionChanged?: (selectedRows: any[]) => void;
}

/**
 * Enterprise data grid on AG Grid Community (free / MIT) with a branded Quartz
 * theme that automatically follows the app's light/dark mode.
 */
export function DataGrid({
  rows,
  columnDefs,
  defaultColDef,
  getRowId,
  exportName = "export",
  height = 560,
  quickFilterPlaceholder = "بحث سريع في كل الأعمدة...",
  rowSelection,
  onSelectionChanged,
}: DataGridProps) {
  const [mounted, setMounted] = useState(false);
  const [quickFilter, setQuickFilter] = useState("");
  const [dark, setDark] = useState(false);
  const apiRef = useRef<GridApi | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Follow the app theme: AG Grid's JS theme needs to know whether the
  // `dark` class is present on <html> (toggled by the theme switcher).
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const onReady = useCallback((e: GridReadyEvent) => {
    apiRef.current = e.api;
    if (onSelectionChanged) {
      e.api.addEventListener("selectionChanged", () => {
        const sel = e.api.getSelectedRows();
        onSelectionChanged(sel);
      });
    }
  }, [onSelectionChanged]);

  const onExport = useCallback(() => {
    try {
      // Count rows actually visible after the quick filter — CSV export only
      // writes the currently displayed rows, so report that number.
      const api = apiRef.current;
      const count = api?.getDisplayedRowCount() ?? rows.length;
      if (count === 0) {
        toast.error("لا توجد بيانات للتصدير");
        return;
      }
      // exportDataAsCsv is synchronous (no reliable Promise) — toast right after.
      api?.exportDataAsCsv({ fileName: `${exportName}.csv`, allColumns: true });
      toast.success(`تم تصدير ${count} سجل إلى ${exportName}.csv`);
    } catch {
      toast.error("فشل تصدير CSV");
    }
  }, [exportName, rows.length]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm shadow-black/[0.03]">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={quickFilter}
            onChange={(e) => setQuickFilter(e.target.value)}
            placeholder={quickFilterPlaceholder}
            className="w-full rounded-xl border border-border bg-muted py-2.5 ps-10 pe-3 text-sm text-foreground outline-none transition focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="tnum inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary">
            <Table2 className="h-3.5 w-3.5" />
            {rows.length} سجل
          </span>
          <button
            onClick={onExport}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" /> تصدير CSV
          </button>
        </div>
      </div>

      <div style={{ height, width: "100%" }} dir="rtl" className="w-full">
        {mounted ? (
          <AgGrid
            dark={dark}
            rowData={rows}
            columnDefs={columnDefs}
            defaultColDef={
              defaultColDef ?? {
                sortable: true,
                filter: true,
                resizable: true,
                flex: 1,
                minWidth: 120,
                // Keep text readable inside cells: taller rows and wrapping so
                // long Arabic values (titles, descriptions, details) are not
                // clipped vertically.
                wrapText: true,
                autoHeight: true,
                // Vertically center every cell's content between the top and
                // bottom of its row (chips, avatars, badges align nicely).
                cellStyle: {
                  display: "flex",
                  alignItems: "center",
                  lineHeight: "1.4",
                },
              }
            }
            getRowId={getRowId ?? ((p: { data: any }) => String(p.data.id))}
            enableRtl
            rowSelection={rowSelection}
            quickFilterText={quickFilter}
            animateRows
            pagination
            paginationPageSize={25}
            paginationPageSizeSelector={[15, 25, 50, 100]}
            suppressCellFocus
            // Larger rows + headers so badges, chips and multi-line cells fit.
            rowHeight={52}
            headerHeight={46}
            overlayNoRowsTemplate={
              '<span style="padding:24px;color:var(--muted-foreground);font-size:13px">لا توجد سجلات مطابقة</span>'
            }
            onGridReady={onReady}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            جارٍ تحميل الجدول...
          </div>
        )}
      </div>
    </div>
  );
}
