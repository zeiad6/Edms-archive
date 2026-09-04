"use client";

import { useState } from "react";
import { useActionState } from "react";
import { AlertCircle, Check, Copy, KeyRound, Loader2, Lock, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/format";
import { LoginForm } from "./login-form";
import { Avatar } from "@/components/ui";
import { ROLE_META } from "@/lib/format";
import { switchUser } from "@/actions/auth";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

export interface LoginUserOption {
  id: number;
  name: string;
  role: string;
  jobTitle: string | null;
  avatarColor: string;
}

type Tab = "password" | "picker";

const initialState = { error: undefined as string | undefined };

/** Shared field styling — matches the password-tab form (h-11, icon padding). */
const inputClass =
  "h-11 w-full rounded-xl border border-border bg-card pr-10 pl-3 text-left text-sm text-foreground shadow-sm outline-none transition-all duration-150 placeholder:text-muted-foreground/50 hover:border-primary/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/20";

/** Shared primary button styling — matches the password-tab form. */
const submitClass =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-150 hover:bg-primary/90 hover:shadow-primary/35 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60";

/**
 * Password step for a picked user. Rendered with `key={user.id}` so the
 * action state (and any previous error) never leaks into the next selection.
 * On success `switchUser` signs the session and the login page redirects to
 * "/" after the route refresh.
 */
function UserPasswordPanel({
  user,
  onCancel,
}: {
  user: LoginUserOption;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(switchUser, initialState);

  return (
    <form action={formAction} className="space-y-4 p-6">
      <input type="hidden" name="userId" value={user.id} />
      <div className="flex items-center gap-3">
        <Avatar name={user.name} color={user.avatarColor} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">{user.name}</span>
          <span className="block text-xs text-muted-foreground">
            {user.jobTitle || t(ROLE_META[user.role]?.label || "") || user.role}
          </span>
        </span>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("إلغاء")}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div>
        <label htmlFor="picker-password" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
          {t("كلمة المرور")}
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80" />
          <input
            id="picker-password"
            name="password"
            type="password"
            required
            autoFocus
            autoComplete="current-password"
            dir="ltr"
            placeholder="••••••••"
            className={inputClass}
          />
        </div>
      </div>

      {state?.error && (
        <p
          role="alert"
          className="animate-fadein flex items-start gap-2 rounded-xl bg-danger/10 px-3 py-2.5 text-xs font-medium leading-relaxed text-danger ring-1 ring-inset ring-danger/20"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{state.error}</span>
        </p>
      )}

      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        {pending ? t("جاري تسجيل الدخول…") : t("دخول")}
      </button>
    </form>
  );
}

/**
 * Click-to-copy for the displayed default password (same literal as
 * DEFAULT_PASSWORD in src/lib/password.ts — hardcoded here because that
 * module imports node:crypto and cannot be bundled client-side).
 */
function DefaultPasswordCopy() {
  const [copied, setCopied] = useState(false);
  useLang();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText("Password@123");
    } catch {
      // Clipboard API unavailable (permissions) — fallback via selection.
      const ta = document.createElement("textarea");
      ta.value = "Password@123";
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    toast.success(t("تم نسخ كلمة المرور الافتراضية"));
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={t("اضغط للنسخ")}
      aria-label={t("نسخ كلمة المرور الافتراضية")}
      className="tnum inline-flex cursor-pointer items-center gap-1 rounded-md bg-white/10 px-1.5 py-0.5 font-semibold text-white ring-1 ring-inset ring-white/15 transition hover:bg-white/20 hover:ring-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
    >
      <span dir="ltr">Password@123</span>
      {copied ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3 opacity-70" />}
    </button>
  );
}

/** Login page tabs: password login (default) + quick user picker (demo). */
export function LoginTabs({ users }: { users: LoginUserOption[] }) {
  const [tab, setTab] = useState<Tab>("password");
  const [selected, setSelected] = useState<LoginUserOption | null>(null);
  useLang(); // re-render when the language toggles

  return (
    <>
      {/* Segmented pill control */}
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-muted/80 p-1 shadow-inner ring-1 ring-inset ring-border/50 backdrop-blur">
        <button
          type="button"
          onClick={() => setTab("password")}
          aria-pressed={tab === "password"}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            tab === "password"
              ? "bg-card text-foreground shadow-md ring-1 ring-border/60"
              : "text-muted-foreground hover:bg-card/30 hover:text-foreground"
          )}
        >
          <KeyRound className="h-3.5 w-3.5" /> {t("تسجيل الدخول")}
        </button>
        <button
          type="button"
          onClick={() => setTab("picker")}
          aria-pressed={tab === "picker"}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            tab === "picker"
              ? "bg-card text-foreground shadow-md ring-1 ring-border/60"
              : "text-muted-foreground hover:bg-card/30 hover:text-foreground"
          )}
        >
          <UsersRound className="h-3.5 w-3.5" /> {t("اختيار المستخدم")}
        </button>
      </div>

      {/* One unified card — both tabs share the same surface */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card/80 shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
        {tab === "password" ? (
          <LoginForm />
        ) : (
          <>
            <div className="border-b border-border bg-muted/30 px-6 py-3.5">
              <p className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                {selected ? <Lock className="h-3.5 w-3.5" /> : <UsersRound className="h-3.5 w-3.5" />}
                {selected ? t("أدخل كلمة المرور") : t("اختر المستخدم (تجريبي)")}
              </p>
            </div>
            {selected ? (
              <UserPasswordPanel key={selected.id} user={selected} onCancel={() => setSelected(null)} />
            ) : (
              <div className="max-h-[320px] overflow-y-auto divide-y divide-border">
                {users.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelected(u)}
                    className="flex w-full items-center gap-4 px-6 py-3.5 text-start transition-colors duration-150 hover:bg-muted/60 active:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <Avatar name={u.name} color={u.avatarColor} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">{u.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {u.jobTitle || t(ROLE_META[u.role]?.label || "") || u.role}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        ROLE_META[u.role]?.badge
                      )}
                    >
                      {t(ROLE_META[u.role]?.label || "") || u.role}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Default-password hint + demo accounts (password tab only). These sit
          below the card on the dark backdrop, so they use white-based alpha
          tones instead of theme tokens — readable in both appearances. */}
      {tab === "password" && (
        <div className="mt-4 space-y-2.5">
          <p className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-[11px] leading-relaxed text-white/65">
            {t("كلمة المرور الافتراضية لجميع الحسابات: ")}
            <DefaultPasswordCopy />
          </p>
          <details className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[11px] text-white/65 shadow-sm backdrop-blur transition-colors duration-150 open:bg-white/[0.06] hover:border-primary/40">
            <summary className="cursor-pointer select-none font-semibold text-white/80">
              {t("حسابات تجريبية")}
            </summary>
            <ul dir="ltr" className="tnum mt-2 space-y-1 text-left">
              <li>k.alomari — {t("مدير النظام (admin)")}</li>
              <li>s.almalki — {t("مشرفة الشؤون المالية")}</li>
              <li>n.alqahtani — {t("أخصائية موارد بشرية")}</li>
              <li>m.alzahrani — {t("سكرتيرة تنفيذية")}</li>
            </ul>
          </details>
        </div>
      )}

      {/* Footer credits (dev + phone) */}
      <div className="mt-6 border-t border-white/10 pt-4 text-center text-[11px] leading-relaxed text-white/55">
        <p>{t("واجهة محاكاة صلاحيات · نظام تجريبي")}</p>
        <p className="mt-1">
          {t("نظام أرشفة إلكترونية مفتوح المصدر")}
        </p>
      </div>
    </>
  );
}