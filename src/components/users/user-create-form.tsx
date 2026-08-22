"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createUser } from "@/actions/users";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

const inputCls =
  "w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30";

/**
 * Client-side create-user form. Submits to the `createUser` server action,
 * surfaces Arabic validation errors via sonner toast, and refreshes the
 * server-rendered list after a successful insert.
 */
export function UserCreateForm({
  departments: depts,
}: {
  departments: { id: number; name: string }[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData(e.currentTarget);
      await createUser(fd);
      toast.success("تم إضافة المستخدم بنجاح");
      formRef.current?.reset();
      // The action revalidates /users; refresh() re-fetches the server component.
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل إضافة المستخدم");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      <input name="name" required placeholder="الاسم الكامل" className={inputCls} />
      <input name="email" type="email" required placeholder="البريد الإلكتروني" className={inputCls} />
      <div>
        <input
          name="username"
          required
          placeholder="اسم الدخول — يُستخدم لتسجيل الدخول"
          autoComplete="off"
          dir="ltr"
          className={inputCls}
        />
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          اسم الدخول يُستخدم لتسجيل الدخول — أحرف صغيرة وفريد.
        </p>
      </div>
      <div>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="كلمة المرور"
          autoComplete="new-password"
          className={inputCls}
        />
        <p className="mt-1 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <KeyRound className="mt-0.5 h-3 w-3 shrink-0" />
          8 أحرف على الأقل — تُفرض على المستخدم تغييرها عند أول دخول.
        </p>
      </div>
      <input name="jobTitle" placeholder="المسمى الوظيفي" className={inputCls} />
      <div className="grid grid-cols-2 gap-2">
        <select name="role" defaultValue="staff" className={inputCls}>
          <option value="staff">موظف</option>
          <option value="manager">مشرف قسم</option>
          <option value="admin">مدير النظام</option>
        </select>
        <select name="departmentId" defaultValue="" className={inputCls}>
          <option value="">القسم</option>
          {depts.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "جاري الإضافة..." : "إضافة المستخدم"}
      </button>
    </form>
  );
}