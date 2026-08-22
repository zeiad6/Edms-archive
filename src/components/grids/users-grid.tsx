"use client";

import { useMemo } from "react";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "@/components/data-grid";
import { ROLE_META, formatDate, initials, cn } from "@/lib/format";
import { UserActions } from "@/components/users/user-actions";
import type { UserRow } from "@/components/users/user-row";

/** Static column definitions — module scope so AG Grid keeps stable identity across renders. */
const BASE_COLUMNS: ColDef<UserRow>[] = [
    {
      headerName: "المستخدم",
      field: "name",
      flex: 1.6,
      minWidth: 140,
      cellRenderer: (p: any) => (
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ backgroundColor: p.data.avatarColor }}
          >
            {initials(p.data.name)}
          </span>
          <div className="min-w-0">
            <div className="truncate font-semibold text-foreground">{p.data.name}</div>
            <div className="truncate text-[11px] text-muted-foreground">{p.data.email}</div>
          </div>
        </div>
      ),
    },
    {
      headerName: "اسم الدخول",
      field: "username",
      minWidth: 110,
      cellRenderer: (p: any) => (
        <span dir="ltr" className="tnum truncate text-muted-foreground">{p.value}</span>
      ),
    },
    {
      headerName: "المسمى",
      field: "jobTitle",
      minWidth: 100,
      cellRenderer: (p: any) => p.value ?? <span className="text-muted-foreground">—</span>,
    },
    {
      headerName: "الدور",
      field: "role",
      minWidth: 90,
      filter: "agSetColumnFilter",
      cellRenderer: (p: any) => {
        const m = ROLE_META[p.value];
        return (
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
              m?.badge ?? "bg-muted text-muted-foreground"
            )}
          >
            {m?.label ?? p.value}
          </span>
        );
      },
    },
    {
      headerName: "القسم",
      field: "deptName",
      minWidth: 100,
      filter: "agSetColumnFilter",
      cellRenderer: (p: any) => p.value ?? <span className="text-muted-foreground">—</span>,
    },
    {
      headerName: "المستندات",
      field: "docs",
      minWidth: 70,
      filter: "agNumberColumnFilter",
      cellRenderer: (p: any) => (
        <span className="tnum inline-flex items-center justify-center rounded-lg bg-muted px-2 py-0.5 text-xs font-bold text-foreground">
          {p.value}
        </span>
      ),
    },
    {
      headerName: "تاريخ الانضمام",
      field: "joined",
      minWidth: 100,
      filter: "agDateColumnFilter",
      valueFormatter: (p: any) => (p.value ? formatDate(p.value) : "—"),
      cellClass: "text-muted-foreground",
    },
];

export function UsersGrid({
  rows,
  departments: depts,
  currentUserId,
}: {
  rows: UserRow[];
  departments: { id: number; name: string }[];
  currentUserId?: number;
}) {
  // Actions column depends on props — merged per-render, static columns stay stable.
  const columnDefs = useMemo<ColDef<UserRow>[]>(
    () => [
      ...BASE_COLUMNS,
      {
        headerName: "",
        field: "id",
        width: 90,
        sortable: false,
        filter: false,
        cellRenderer: (p: any) => {
          const user = p.data as UserRow;
          return <UserActions user={user} departments={depts} currentUserId={currentUserId} />;
        },
      },
    ],
    [depts, currentUserId]
  );

  return (
    <DataGrid rows={rows} columnDefs={columnDefs} getRowId={(p) => `u-${p.data.id}`} exportName="users" height="max(560px, calc(100vh - 200px))" />
  );
}
