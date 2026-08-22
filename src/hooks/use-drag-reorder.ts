"use client";

import { useState, useCallback } from "react";

/**
 * Lightweight drag-to-reorder hook for index-based lists.
 *
 * Provides event handlers to wire onto draggable elements and exposes
 * the current drag index for visual feedback (e.g. opacity).
 */
export function useDragReorder(onReorder: (from: number, to: number) => void) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const handleDragStart = useCallback((idx: number) => {
    setDragIdx(idx);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, idx: number) => {
      e.preventDefault();
      if (dragIdx === null || dragIdx === idx) return;
      onReorder(dragIdx, idx);
      setDragIdx(idx);
    },
    [dragIdx, onReorder],
  );

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
  }, []);

  return {
    dragIdx,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  } as const;
}
