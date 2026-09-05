"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteDocument } from "@/actions/documents";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DocumentDeleteDialog({ id, title }: { id: number; title: string }) {
  useLang(); // re-render on language toggle
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function doDelete() {
    setBusy(true);
    try {
      await deleteDocument(id);
      toast.success(t("تم حذف المستند بنجاح"));
      router.push("/documents");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? t(e.message) : t("تعذّر الحذف"));
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        className="border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />{t("حذف")}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("تأكيد حذف المستند")}</DialogTitle>
            <DialogDescription>
              {t("هل أنت متأكد من حذف “{name}” نهائياً؟ لا يمكن التراجع عن هذا الإجراء وسيُحذف مع إصداراته.", { name: title })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" onClick={doDelete} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t("نعم، احذف نهائياً")}
            </Button>
            <DialogClose asChild>
              <Button variant="outline">{t("إلغاء")}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
