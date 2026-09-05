"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useState } from "react";
import { updateUser, deleteUser } from "@/actions/users";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import type { UserRow } from "./user-row";

const inputCls = "input-base";

export function UserActions({
  user,
  departments: depts,
  currentUserId,
}: {
  user: UserRow;
  departments: { id: number; name: string }[];
  currentUserId?: number;
}) {
  useLang(); // re-render on language toggle
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const isSelf = user.id === currentUserId;

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData(e.currentTarget);
      await updateUser(fd);
      toast.success(t("تم تحديث بيانات المستخدم"));
      setEditOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? t(err.message) : t("فشل تحديث المستخدم"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("id", String(user.id));
      await deleteUser(fd);
      toast.success(t("تم حذف المستخدم"));
      setDeleteOpen(false);
    } catch {
      toast.error(t("فشل حذف المستخدم"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1" dir="ltr">
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger asChild>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl p-1.5 text-muted-foreground shadow-soft transition hover:bg-muted hover:text-foreground hover:shadow-card"
            title={t("تعديل")}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("تعديل المستخدم")}</DialogTitle>
            <DialogDescription>{user.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <input type="hidden" name="id" value={user.id} />
            <input name="name" defaultValue={user.name} required placeholder={t("الاسم الكامل")} className={inputCls} />
            <input name="email" type="email" defaultValue={user.email} required placeholder={t("البريد الإلكتروني")} className={inputCls} />
            <input name="username" defaultValue={user.username} required placeholder={t("اسم الدخول")} dir="ltr" className={inputCls} />
            <input name="jobTitle" defaultValue={user.jobTitle ?? ""} placeholder={t("المسمى الوظيفي")} className={inputCls} />
            <div>
              <input
                name="newPassword"
                type="password"
                placeholder={t("اتركه فارغاً لعدم التغيير — إن أُدخل يُفرض التغيير عند أول دخول")}
                autoComplete="new-password"
                className={inputCls}
              />
              <p className="mt-1.5 ps-1 text-[11px] leading-relaxed text-muted-foreground">{t("كلمة مرور جديدة (اختياري) — 8 أحرف على الأقل؛ إن أُدخلت يُفرض على المستخدم تغييرها عند أول دخول.")}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select name="role" defaultValue={user.role} className={inputCls}>
                <option value="staff">{t("موظف")}</option>
                <option value="manager">{t("مشرف قسم")}</option>
                <option value="admin">{t("مدير النظام")}</option>
              </select>
              <select
                name="departmentId"
                defaultValue={user.deptName ? String(depts.find((d) => d.name === user.deptName)?.id ?? "") : ""}
                className={inputCls}
              >
                <option value="">{t("القسم")}</option>
                {depts.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 ps-1 text-xs text-muted-foreground">
              <input type="checkbox" name="active" defaultChecked className="h-4 w-4 rounded border-border bg-muted text-primary" />{t("حساب نشط")}</label>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">{t("إلغاء")}</Button>
              </DialogClose>
              <Button type="submit" disabled={saving}>{saving ? t("جارٍ الحفظ…") : t("حفظ")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTrigger asChild>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl p-1.5 text-muted-foreground shadow-soft transition hover:bg-rose-500/10 hover:text-rose-500 hover:shadow-card disabled:opacity-30 disabled:shadow-none"
            title={t("حذف")}
            disabled={isSelf}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("حذف المستخدم")}</DialogTitle>
            <DialogDescription>
              {isSelf
                ? t("لا يمكنك حذف نفسك.")
                : t("هل أنت متأكد من حذف “{n}”؟ ستنقل مستنداته إلى حسابك الحالي.", { n: user.name })}
            </DialogDescription>
          </DialogHeader>
          {!isSelf && (
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">{t("إلغاء")}</Button>
              </DialogClose>
              <Button type="button" variant="destructive" disabled={saving} onClick={handleDelete}>
                {saving ? t("جاري الحذف...") : t("حذف")}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
