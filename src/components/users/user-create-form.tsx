"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createUser } from "@/actions/users";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

const inputCls = "input-base";

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
  useLang(); // re-render on language toggle
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData(e.currentTarget);
      await createUser(fd);
      toast.success(t("تم إضافة المستخدم بنجاح"));
      formRef.current?.reset();
      // The action revalidates /users; refresh() re-fetches the server component.
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? t(err.message) : t("فشل إضافة المستخدم"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <input name="name" required placeholder={t("الاسم الكامل")} className={inputCls} />
      <input name="email" type="email" required placeholder={t("البريد الإلكتروني")} className={inputCls} />
      <div>
        <input
          name="username"
          required
          placeholder={t("اسم الدخول — يُستخدم لتسجيل الدخول")}
          autoComplete="off"
          dir="ltr"
          className={inputCls}
        />
        <p className="mt-1.5 ps-1 text-[11px] leading-relaxed text-muted-foreground">{t("اسم الدخول يُستخدم لتسجيل الدخول — أحرف صغيرة وفريد.")}</p>
      </div>
      <div>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder={t("كلمة المرور")}
          autoComplete="new-password"
          className={inputCls}
        />
        <p className="mt-1.5 flex items-start gap-2 ps-1 text-[11px] leading-relaxed text-muted-foreground">
          <KeyRound className="mt-0.5 h-3 w-3 shrink-0" />{t("8 أحرف على الأقل — تُفرض على المستخدم تغييرها عند أول دخول.")}</p>
      </div>
      <input name="jobTitle" placeholder={t("المسمى الوظيفي")} className={inputCls} />
      <div className="grid grid-cols-2 gap-3">
        <select name="role" defaultValue="staff" className={inputCls}>
          <option value="staff">{t("موظف")}</option>
          <option value="manager">{t("مشرف قسم")}</option>
          <option value="admin">{t("مدير النظام")}</option>
        </select>
        <select name="departmentId" defaultValue="" className={inputCls}>
          <option value="">{t("القسم")}</option>
          {depts.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="min-h-[2.625rem] w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:shadow-card hover:brightness-[1.03] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
      >
        {saving ? t("جاري الإضافة...") : t("إضافة المستخدم")}
      </button>
    </form>
  );
}