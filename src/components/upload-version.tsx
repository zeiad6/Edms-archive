"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

const inputCls =
  "h-10 w-full rounded-xl border border-border bg-muted px-3 text-sm text-foreground shadow-soft outline-none transition hover:border-primary/30 focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30";

export function UploadVersion({ docId, canWrite }: { docId: number; canWrite: boolean }) {
  useLang(); // re-render on language toggle
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!canWrite) return null;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("file", file);
    const note = (document.getElementById("ver-note") as HTMLInputElement | null)?.value || "";
    fd.set("note", note);
    try {
      const res = await fetch(`/api/documents/${docId}/versions`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(t(data.error || "فشل رفع الإصدار"));
      toast.success(t("تمت إضافة الإصدار {n}", { n: data.version }));
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? t(err.message) : t("فشل رفع الإصدار"));
    } finally {
      // Always release busy — success path previously left the button disabled forever.
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="w-full">
        <Plus className="h-4 w-4" />{t("رفع إصدار جديد")}</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("رفع إصدار جديد")}</DialogTitle>
          <DialogDescription>{t("سيُصبح هذا الملف الإصدار الحالي للمستند، مع الاحتفاظ بسجل الإصدارات السابقة.")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <input id="ver-note" placeholder={t("ملاحظة الإصدار (اختياري)...")} className={inputCls} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/40 py-8 text-sm text-muted-foreground transition hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <UploadCloud className="h-6 w-6 text-primary" />}
            {busy ? t("جارٍ الرفع...") : t("اختر الملف لرفعه كإصدار جديد")}
          </button>
          <input ref={fileRef} type="file" className="hidden" onChange={onFile} />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={busy}>{t("إغلاق")}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
