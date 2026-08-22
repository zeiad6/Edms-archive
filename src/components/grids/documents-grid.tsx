"use client";

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

/** Static column definitions — module scope so AG Grid keeps stable identity across renders. */
const BASE_COLUMNS: ColDef<DocRow>[] = [
    {
      headerName: "المستند",
      field: "title",
      flex: 2,
      minWidth: 220,
      filter: "agTextColumnFilter",
      cellRenderer: (p: any) => {
        const d = p.data as DocRow;
        return (
          <div className="flex items-center gap-2">
            <Link
              href={`/documents/${d.id}`}
              className="truncate font-semibold text-foreground transition hover:text-primary"
            >
              {d.title}
            </Link>
            {d.confidential && <Lock className="h-3 w-3 shrink-0 text-rose-500" />}
          </div>
        );
      },
    },
    {
      headerName: "الرقم المرجعي",
      field: "docNumber",
      minWidth: 110,
      cellRenderer: (p: any) =>
        p.value ? (
          <span className="font-mono text-xs text-muted-foreground">{p.value}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      headerName: "النوع",
      field: "docType",
      minWidth: 100,
      filter: "agSetColumnFilter",
      cellRenderer: (p: any) => {
        const d = p.data as DocRow;
        return d.docType ? (
          <span
            className="inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold"
            style={docTypeStyle(d.docTypeColor)}
          >
            {d.docType}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      headerName: "الحالة",
      field: "status",
      minWidth: 110,
      filter: "agSetColumnFilter",
      cellRenderer: (p: any) => {
        const m = STATUS_META[p.value] ?? STATUS_META.active;
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              m.badge
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} />
            {m.label}
          </span>
        );
      },
    },
    {
      headerName: "القسم",
      field: "departmentName",
      minWidth: 120,
      filter: "agSetColumnFilter",
      cellRenderer: (p: any) => {
        const d = p.data as DocRow;
        return d.departmentName ? (
          <span className="inline-flex items-center gap-1.5 text-foreground">
            <span
              className="h-2 w-2 rounded-full"
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
      headerName: "الحجم",
      field: "fileSize",
      minWidth: 80,
      filter: "agNumberColumnFilter",
      cellRenderer: (p: any) => (
        <span className="tnum text-muted-foreground">{formatBytes(p.value)}</span>
      ),
    },
    {
      headerName: "التاريخ",
      field: "date",
      minWidth: 100,
      filter: "agDateColumnFilter",
      sort: "desc",
      valueFormatter: (p: any) => (p.value ? formatDate(p.value) : "—"),
      cellClass: "text-muted-foreground",
    },
];

/** Memoized documents grid — selection column is merged per-render, static columns stay stable. */
export const DocumentsGrid = memo(function DocumentsGrid({
  rows,
  onSelectionChange,
}: {
  rows: DocRow[];
  onSelectionChange?: (selected: DocRow[]) => void;
}) {
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
      ...BASE_COLUMNS,
    ],
    [onSelectionChange]
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
