"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useMemo } from "react";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "@/components/data-grid";
import { ROLE_META, formatDate, initials, cn } from "@/lib/format";
import { UserActions } from "@/components/users/user-actions";
import type { UserRow } from "@/components/users/user-row";

/** Column definitions rebuilt when the language toggles (headers + labels). */
function buildColumns(): ColDef<UserRow>[] {
  return [
    {
      headerName: t("المستخدم"),
      field: "name",
      flex: 1.6,
      minWidth: 140,
      cellRenderer: (p: any) => (
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm ring-2 ring-card"
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
      headerName: t("اسم الدخول"),
      field: "username",
      minWidth: 110,
      cellRenderer: (p: any) => (
        <span dir="ltr" className="tnum truncate text-muted-foreground">{p.value}</span>
      ),
    },
    {
      headerName: t("المسمى"),
      field: "jobTitle",
      minWidth: 100,
      cellRenderer: (p: any) => p.value ?? <span className="text-muted-foreground">—</span>,
    },
    {
      headerName: t("الدور"),
      field: "role",
      minWidth: 90,
      filter: "agTextColumnFilter",
      cellRenderer: (p: any) => {
        const m = ROLE_META[p.value];
        return (
          <span
            className={cn(
              "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm ring-1 ring-inset ring-black/[0.06] dark:ring-white/10",
              m?.badge ?? "bg-muted text-muted-foreground"
            )}
          >
            {m?.label ? t(m.label) : p.value}
          </span>
        );
      },
    },
    {
      headerName: t("القسم"),
      field: "deptName",
      minWidth: 100,
      filter: "agTextColumnFilter",
      cellRenderer: (p: any) => p.value ?? <span className="text-muted-foreground">—</span>,
    },
    {
      headerName: t("المستندات"),
      field: "docs",
      minWidth: 70,
      filter: "agNumberColumnFilter",
      cellRenderer: (p: any) => (
        <span className="tnum inline-flex min-w-8 items-center justify-center rounded-lg bg-muted px-2 py-1 text-xs font-bold text-foreground shadow-sm ring-1 ring-inset ring-border/60">
          {p.value}
        </span>
      ),
    },
    {
      headerName: t("تاريخ الانضمام"),
      field: "joined",
      minWidth: 100,
      filter: "agDateColumnFilter",
      valueFormatter: (p: any) => (p.value ? formatDate(p.value) : "—"),
      cellClass: "text-muted-foreground",
    },
  ];
}

export function UsersGrid({
  rows,
  departments: depts,
  currentUserId,
}: {
  rows: UserRow[];
  departments: { id: number; name: string }[];
  currentUserId?: number;
}) {
  const { lang } = useLang(); // re-render on language toggle
  // Actions column depends on props — merged per-render, static columns stay stable.
  const columnDefs = useMemo<ColDef<UserRow>[]>(
    () => [
      ...buildColumns(),
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
    [depts, currentUserId, lang]
  );

  return (
    <DataGrid rows={rows} columnDefs={columnDefs} getRowId={(p) => `u-${p.data.id}`} exportName="users" height="max(560px, calc(100vh - 200px))" />
  );
}
