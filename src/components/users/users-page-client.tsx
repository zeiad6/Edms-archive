"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useState } from "react";
import { LayoutGrid, LayoutList } from "lucide-react";
import { UsersGrid } from "@/components/grids/users-grid";
import { UsersCards } from "./users-cards";
import { cn } from "@/lib/format";
import type { UserRow } from "./user-row";

type ViewMode = "table" | "cards";

export function UsersPageClient({
  rows,
  departments: depts,
  currentUserId,
}: {
  rows: UserRow[];
  departments: { id: number; name: string }[];
  currentUserId?: number;
}) {
  useLang(); // re-render on language toggle
  const [view, setView] = useState<ViewMode>("table");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <div
          dir="ltr"
          className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5"
        >
          <button
            type="button"
            onClick={() => setView("table")}
            title={t("عرض جدولي")}
            className={cn(
              "rounded-md p-1.5 transition",
              view === "table"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutList className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("cards")}
            title={t("عرض بطاقات")}
            className={cn(
              "rounded-md p-1.5 transition",
              view === "cards"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {view === "table" ? (
        <UsersGrid rows={rows} departments={depts} currentUserId={currentUserId} />
      ) : (
        <UsersCards rows={rows} departments={depts} currentUserId={currentUserId} />
      )}
    </div>
  );
}
