"use client";

import { useEffect, useRef, useState } from "react";
import { Barcode, ChevronDown, ChevronUp, GripVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/format";
import type { ScannedPage } from "@/hooks/use-page-manager";

interface PagesGridProps {
  pages: ScannedPage[];
  dragIdx: number | null;
  onDragStart: (idx: number) => void;
  onDragOver: (e: React.DragEvent, idx: number) => void;
  onDragEnd: () => void;
  /** Move a page from `fromIdx` to `toIdx` (used by the up/down buttons). */
  onMovePage: (fromIdx: number, toIdx: number) => void;
  onRemovePage: (id: string) => void;
}

const CONFIRM_RESET_MS = 3000;

/**
 * Draggable thumbnail grid of scanned pages.
 *
 * - Page number + barcode badge (top), order actions (bottom).
 * - Delete uses a two-step inline confirm (first tap arms, second deletes)
 *   so accidental taps never lose a page.
 * - Up/down buttons provide an accessible + touch fallback when HTML5
 *   drag & drop is unavailable (iOS, keyboard users).
 */
export function PagesGrid({
  pages,
  dragIdx,
  onDragStart,
  onDragOver,
  onDragEnd,
  onMovePage,
  onRemovePage,
}: PagesGridProps) {
  /** ID of the page whose delete button is currently armed for confirmation. */
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    },
    [],
  );

  const resetConfirm = () => {
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    confirmTimer.current = null;
    setConfirmId(null);
  };

  /** Arm the confirm state, or delete when the same page is confirmed again. */
  function handleDeleteClick(id: string) {
    if (confirmId === id) {
      onRemovePage(id);
      resetConfirm();
    } else {
      setConfirmId(id);
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
      confirmTimer.current = window.setTimeout(resetConfirm, CONFIRM_RESET_MS);
    }
  }

  /** Move one step via the up/down buttons (clamped to list bounds). */
  function handleMovePage(fromIdx: number, toIdx: number) {
    if (toIdx < 0 || toIdx >= pages.length) return;
    onMovePage(fromIdx, toIdx);
    resetConfirm();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 border-b border-border pb-3 text-xs font-medium text-muted-foreground">
        <GripVertical className="h-3.5 w-3.5" />
        اسحب المقبض لإعادة الترتيب أو استخدم الأسهم — {pages.length}{" "}
        {pages.length === 1 ? "صفحة" : "صفحات"}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {pages.map((page, idx) => {
          const isConfirming = confirmId === page.id;
          return (
            <div
              key={page.id}
              draggable
              onDragStart={() => {
                resetConfirm();
                onDragStart(idx);
              }}
              onDragOver={(e) => onDragOver(e, idx)}
              onDragEnd={onDragEnd}
              aria-label={`صفحة ${idx + 1} من ${pages.length}`}
              className={cn(
                "group relative overflow-hidden rounded-xl border border-border bg-muted transition hover:border-primary/50",
                dragIdx === idx && "opacity-50",
              )}
            >
              {/* Page number + order indicator */}
              <div className="absolute left-1 top-1 z-10 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                <GripVertical className="h-3 w-3 text-white/60" />
                {idx + 1} / {pages.length}
              </div>

              {/* Barcode badge */}
              {page.barcode && (
                <div className="absolute right-1 top-1 z-10 flex items-center gap-1 rounded-md bg-emerald-500/80 px-1.5 py-0.5 text-[10px] text-white">
                  <Barcode className="h-3 w-3" />
                  <span title={page.barcode.text}>
                    {page.barcode.text.slice(0, 12)}
                    {page.barcode.text.length > 12 ? "…" : ""}
                  </span>
                </div>
              )}

              {/* Move up / down (accessible + touch fallback) */}
              <div className="absolute bottom-1 left-1 z-10 flex gap-1">
                <button
                  type="button"
                  draggable={false}
                  disabled={idx === 0}
                  onClick={() => handleMovePage(idx, idx - 1)}
                  title="تحريك لأعلى"
                  aria-label={`تحريك صفحة ${idx + 1} لأعلى`}
                  className="flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  draggable={false}
                  disabled={idx === pages.length - 1}
                  onClick={() => handleMovePage(idx, idx + 1)}
                  title="تحريك لأسفل"
                  aria-label={`تحريك صفحة ${idx + 1} لأسفل`}
                  className="flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>

              {/* Delete with two-step confirm — always visible (touch-friendly) */}
              <button
                type="button"
                draggable={false}
                onClick={() => handleDeleteClick(page.id)}
                title={isConfirming ? "اضغط مرة أخرى للتأكيد" : "حذف الصفحة"}
                aria-label={
                  isConfirming
                    ? `تأكيد حذف صفحة ${idx + 1}`
                    : `حذف صفحة ${idx + 1}`
                }
                className={cn(
                  "absolute bottom-1 right-1 z-10 inline-flex h-6 min-w-6 items-center justify-center gap-1 rounded-md px-1.5 text-[10px] font-semibold text-white transition",
                  isConfirming
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-black/60 opacity-80 hover:bg-rose-600 hover:opacity-100",
                )}
              >
                {isConfirming ? "تأكيد؟" : <Trash2 className="h-3 w-3" />}
              </button>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={page.dataUrl}
                alt={`صفحة ${idx + 1}`}
                className="h-36 w-full object-cover"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
