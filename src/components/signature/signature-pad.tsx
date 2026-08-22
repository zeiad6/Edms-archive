"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Pen, Trash2, Check, Loader2 } from "lucide-react";

interface SignaturePadProps {
  documentId: number;
  onSigned?: () => void;
}

export function SignaturePad({ documentId, onSigned }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const t = e.touches[0] || e.changedTouches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    setDrawing(true);
    setHasContent(true);
  }, []);

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!drawing) return;
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const p = getPos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    },
    [drawing]
  );

  const stopDraw = useCallback(() => {
    setDrawing(false);
  }, []);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
    setError("");
  };

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasContent) return;
    setBusy(true);
    setError("");
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const fd = new FormData();
      fd.set("documentId", String(documentId));
      fd.set("dataUrl", dataUrl);
      const res = await fetch("/api/signatures", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json()).error || "فشل الحفظ");
      clear();
      onSigned?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل حفظ التوقيع");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">التوقيع الإلكتروني</span>
        <div className="flex items-center gap-1">
          {hasContent && (
            <>
              <button
                type="button"
                onClick={clear}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-foreground transition hover:bg-muted"
              >
                <Trash2 className="h-3 w-3" /> مسح
              </button>
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-lg bg-foreground px-2.5 py-1 text-[11px] font-medium text-background transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                حفظ
              </button>
            </>
          )}
        </div>
      </div>
      <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/50 transition focus-within:border-primary/50">
        {!hasContent && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Pen className="h-4 w-4" /> وقّع هنا بالماوس أو باللمس
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={500}
          height={150}
          className="block w-full touch-none cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
      </div>
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  );
}

export function SignatureDisplay({ dataUrl, label }: { dataUrl: string; label?: string | null }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="mb-1 text-[11px] font-medium text-muted-foreground">{label || "توقيع"}</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dataUrl} alt="توقيع" className="h-12 object-contain" />
    </div>
  );
}
