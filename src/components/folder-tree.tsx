"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { memo, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Folder, FolderOpen, Files } from "lucide-react";
import { cn } from "@/lib/format";

export interface FolderNode {
  id: number;
  name: string;
  parentId: number | null;
  deptName: string | null;
  deptColor: string | null;
  docCount: number;
}

/** Module-scope comparator — stable identity, no re-creation per render. */
const byName = (a: FolderNode, b: FolderNode) => a.name.localeCompare(b.name, "ar");

export function FolderTree({ folders }: { folders: FolderNode[] }) {
  useLang(); // re-render on language toggle
  const roots = folders.filter((f) => f.parentId === null).sort(byName);
  return (
    <div className="space-y-1">
      <Link
        href="/documents"
        className="flex items-center gap-2.5 rounded-xl border border-dashed border-border bg-muted/40 px-3 py-2.5 text-sm font-medium text-muted-foreground shadow-soft transition hover:border-primary/30 hover:bg-muted hover:text-foreground hover:shadow-card"
      >
        <Files className="h-4 w-4" />
        <span className="flex-1">{t("كل المستندات")}</span>
      </Link>
      {roots.map((node) => (
        <TreeNode key={node.id} node={node} all={folders} depth={0} />
      ))}
    </div>
  );
}

/** Memoized node — re-renders only when its own node/all/depth change, not on sibling toggles. */
const TreeNode = memo(function TreeNode({ node, all, depth }: { node: FolderNode; all: FolderNode[]; depth: number }) {
  const [open, setOpen] = useState(true);
  const children = useMemo(
    () => all.filter((f) => f.parentId === node.id).sort(byName),
    [all, node.id]
  );
  const hasChildren = children.length > 0;

  return (
    <div>
      <div
        className="group flex items-center gap-1.5 rounded-xl px-2 py-1.5 transition hover:bg-muted hover:shadow-soft"
        style={{ paddingInlineStart: depth * 18 + 8 }}
      >
        {hasChildren ? (
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? t("طي المجلد") : t("توسيع المجلد")}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", open && "-rotate-90")} />
          </button>
        ) : (
          <span className="h-6 w-6 shrink-0" />
        )}
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-soft ring-1 ring-inset ring-black/5"
          style={{ backgroundColor: `${node.deptColor ?? "#64748b"}1f`, color: node.deptColor ?? "#64748b" }}
        >
          {open && hasChildren ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
        </span>
        <Link
          href={`/documents?folder=${node.id}`}
          className="min-w-0 flex-1 truncate text-sm font-medium text-foreground transition hover:text-primary"
          title={node.name}
        >
          {node.name}
        </Link>
        {node.deptName && (
          <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:inline">{node.deptName}</span>
        )}
        <span
          className={cn(
            "tnum shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold",
            node.docCount > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}
        >
          {node.docCount}
        </span>
      </div>
      {hasChildren && open && (
        <div>
          {children.map((child) => (
            <TreeNode key={child.id} node={child} all={all} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
});
