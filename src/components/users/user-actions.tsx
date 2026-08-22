"use client";

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

const inputCls =
  "w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none transition focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30";

export function UserActions({
  user,
  departments: depts,
  currentUserId,
}: {
  user: UserRow;
  departments: { id: number; name: string }[];
  currentUserId?: number;
}) {
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
      toast.success("تم تحديث بيانات المستخدم");
      setEditOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل تحديث المستخدم");
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
      toast.success("تم حذف المستخدم");
      setDeleteOpen(false);
    } catch {
      toast.error("فشل حذف المستخدم");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1" dir="ltr">
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger asChild>
          <button
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            title="تعديل"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل المستخدم</DialogTitle>
            <DialogDescription>{user.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-3">
            <input type="hidden" name="id" value={user.id} />
            <input name="name" defaultValue={user.name} required placeholder="الاسم الكامل" className={inputCls} />
            <input name="email" type="email" defaultValue={user.email} required placeholder="البريد الإلكتروني" className={inputCls} />
            <input name="username" defaultValue={user.username} required placeholder="اسم الدخول" dir="ltr" className={inputCls} />
            <input name="jobTitle" defaultValue={user.jobTitle ?? ""} placeholder="المسمى الوظيفي" className={inputCls} />
            <div>
              <input
                name="newPassword"
                type="password"
                placeholder="اتركه فارغاً لعدم التغيير — إن أُدخل يُفرض التغيير عند أول دخول"
                autoComplete="new-password"
                className={inputCls}
              />
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                كلمة مرور جديدة (اختياري) — 8 أحرف على الأقل؛ إن أُدخلت يُفرض على المستخدم تغييرها عند أول دخول.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select name="role" defaultValue={user.role} className={inputCls}>
                <option value="staff">موظف</option>
                <option value="manager">مشرف قسم</option>
                <option value="admin">مدير النظام</option>
              </select>
              <select
                name="departmentId"
                defaultValue={user.deptName ? String(depts.find((d) => d.name === user.deptName)?.id ?? "") : ""}
                className={inputCls}
              >
                <option value="">القسم</option>
                {depts.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" name="active" defaultChecked className="h-4 w-4 rounded border-border bg-muted text-primary" />
              حساب نشط
            </label>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">إلغاء</Button>
              </DialogClose>
              <Button type="submit" disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTrigger asChild>
          <button
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-30"
            title="حذف"
            disabled={isSelf}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف المستخدم</DialogTitle>
            <DialogDescription>
              {isSelf
                ? "لا يمكنك حذف نفسك."
                : `هل أنت متأكد من حذف "${user.name}"؟ ستنقل مستنداته إلى حسابك الحالي.`}
            </DialogDescription>
          </DialogHeader>
          {!isSelf && (
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">إلغاء</Button>
              </DialogClose>
              <Button type="button" variant="destructive" disabled={saving} onClick={handleDelete}>
                {saving ? "جاري الحذف..." : "حذف"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
