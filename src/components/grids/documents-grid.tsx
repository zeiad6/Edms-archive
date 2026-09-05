"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { memo, useMemo } from "react";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "@/components/data-grid";
import { Lock } from "lucide-react";
import Link from "next/link";
import {
  STATUS_META,
  docTypeStyle,
  formatBytes,
  formatDate,
  cn,
} from "@/lib/format";

export interface DocRow {
  id: number;
  title: string;
  docNumber: string | null;
  docType: string | null;
  docTypeColor: string | null;
  status: string;
  departmentName: string | null;
  departmentColor: string | null;
  fileSize: number;
  confidential: boolean;
  date: string;
}

/** Column definitions rebuilt when the language toggles (headers + labels). */
function buildColumns(): ColDef<DocRow>[] {
  return [
    {
      headerName: t("المستند"),
      field: "title",
      flex: 2,
      minWidth: 220,
      filter: "agTextColumnFilter",
      cellRenderer: (p: any) => {
        const d = p.data as DocRow;
        return (
          <div className="flex items-center gap-2.5">
            <Link
              href={`/documents/${d.id}`}
              className="truncate font-semibold text-foreground transition-colors hover:text-primary hover:underline hover:underline-offset-4"
            >
              {d.title}
            </Link>
            {d.confidential && <Lock className="h-4 w-4 shrink-0 rounded-md bg-rose-500/10 p-0.5 text-rose-600 dark:text-rose-400" />}
          </div>
        );
      },
    },
    {
      headerName: t("الرقم المرجعي"),
      field: "docNumber",
      minWidth: 110,
      cellRenderer: (p: any) =>
        p.value ? (
          <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground shadow-sm ring-1 ring-inset ring-border/60">{p.value}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      headerName: t("النوع"),
      field: "docType",
      minWidth: 100,
      filter: "agSetColumnFilter",
      cellRenderer: (p: any) => {
        const d = p.data as DocRow;
        return d.docType ? (
          <span
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold shadow-sm ring-1 ring-inset ring-black/[0.06] dark:ring-white/10"
            style={docTypeStyle(d.docTypeColor)}
          >
            {t(d.docType)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      headerName: t("الحالة"),
      field: "status",
      minWidth: 110,
      filter: "agSetColumnFilter",
      cellRenderer: (p: any) => {
        const m = STATUS_META[p.value] ?? STATUS_META.active;
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm ring-1 ring-inset ring-black/[0.06] dark:ring-white/10",
              m.badge
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} />
            {t(m.label)}
          </span>
        );
      },
    },
    {
      headerName: t("القسم"),
      field: "departmentName",
      minWidth: 120,
      filter: "agSetColumnFilter",
      cellRenderer: (p: any) => {
        const d = p.data as DocRow;
        return d.departmentName ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
            <span
              className="h-2 w-2 shrink-0 rounded-full shadow-sm ring-1 ring-inset ring-black/10"
              style={{ backgroundColor: d.departmentColor ?? "#94a3b8" }}
            />
            {d.departmentName}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      headerName: t("الحجم"),
      field: "fileSize",
      minWidth: 80,
      filter: "agNumberColumnFilter",
      cellRenderer: (p: any) => (
        <span className="tnum text-[13px] text-muted-foreground">{formatBytes(p.value)}</span>
      ),
    },
    {
      headerName: t("التاريخ"),
      field: "date",
      minWidth: 100,
      filter: "agDateColumnFilter",
      sort: "desc",
      valueFormatter: (p: any) => (p.value ? formatDate(p.value) : "—"),
      cellClass: "text-muted-foreground",
    },
  ];
}

/** Memoized documents grid — selection column is merged per-render, static columns stay stable. */
export const DocumentsGrid = memo(function DocumentsGrid({
  rows,
  onSelectionChange,
}: {
  rows: DocRow[];
  onSelectionChange?: (selected: DocRow[]) => void;
}) {
  const { lang } = useLang(); // re-render on language toggle
  const columnDefs = useMemo<ColDef<DocRow>[]>(
    () => [
      ...(onSelectionChange
        ? [
            {
              headerName: "",
              field: "id",
              width: 44,
              minWidth: 44,
              headerCheckboxSelection: true,
              checkboxSelection: true,
              showDisabledCheckboxes: false,
              suppressHeaderMenuButton: true,
              sortable: false,
              filter: false,
              resizable: false,
            } as ColDef<DocRow>,
          ]
        : []),
      ...buildColumns(),
    ],
    [onSelectionChange, lang]
  );

  return (
    <DataGrid
      rows={rows}
      columnDefs={columnDefs}
      getRowId={(p) => `doc-${p.data.id}`}
      exportName="documents"
      height="max(580px, calc(100vh - 360px))"
      rowSelection={onSelectionChange ? "multiple" : undefined}
      onSelectionChanged={onSelectionChange ? (sel) => onSelectionChange(sel as DocRow[]) : undefined}
    />
  );
});
