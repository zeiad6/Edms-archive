"use client";

import { useActionState, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { cn, ROLE_META } from "@/lib/format";
import { DEV_EMAIL, DEV_NAME, DEV_TIKTOK_URL, DEV_YOUTUBE_URL, MailMark, TikTokMark, YouTubeMark } from "@/components/brand-marks";
import { LoginForm } from "./login-form";
import { Avatar } from "@/components/ui";
import { switchUser } from "@/actions/auth";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

export interface LoginUserOption {
  id: number;
  name: string;
  role: string;
  jobTitle: string | null;
  avatarColor: string;
  username: string;
  mustChangePassword: number;
}

type Tab = "password" | "picker";

const initialState = { error: undefined as string | undefined };

/** Shared field styling — matches the password-tab form (h-11, icon padding). */
const inputClass =
  "h-11 w-full rounded-xl border border-border bg-card pe-3 ps-10 text-start text-sm text-foreground shadow-soft outline-none transition-all duration-150 placeholder:text-muted-foreground/50 hover:border-primary/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/20";

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
  const [revealed, setRevealed] = useState(false);

  return (
    <form action={formAction} className="animate-fadein space-y-4 p-6">
      <input type="hidden" name="userId" value={user.id} />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("رجوع")}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Avatar name={user.name} color={user.avatarColor} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">{user.name}</span>
          <span className="block text-xs text-muted-foreground">
            {user.jobTitle || t(ROLE_META[user.role]?.label || "") || user.role}
          </span>
        </span>
      </div>

      <div>
        <label
          htmlFor="picker-password"
          className="mb-1.5 block text-xs font-semibold text-muted-foreground"
        >
          {t("كلمة المرور")}
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80" />
          <input
            id="picker-password"
            name="password"
            type={revealed ? "text" : "password"}
            required
            autoFocus
            autoComplete="current-password"
            dir="ltr"
            placeholder="••••••••"
            className={cn(inputClass, "pe-11")}
          />
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-pressed={revealed}
            aria-label={revealed ? t("إخفاء كلمة المرور") : t("إظهار كلمة المرور")}
            title={revealed ? t("إخفاء كلمة المرور") : t("إظهار كلمة المرور")}
            className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
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
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <KeyRound className="h-4 w-4" />
        )}
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
      await navigator.clipboard.writeText("12345678");
    } catch {
      // Clipboard API unavailable (permissions) — fallback via selection.
      const ta = document.createElement("textarea");
      ta.value = "12345678";
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
      className="tnum inline-flex cursor-pointer items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-semibold text-foreground ring-1 ring-inset ring-border transition hover:bg-primary/10 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span dir="ltr">12345678</span>
      {copied ? (
        <Check className="h-3 w-3 text-emerald-300" />
      ) : (
        <Copy className="h-3 w-3 opacity-70" />
      )}
    </button>
  );
}

/** Feature chips — what the system actually does, stated in three lines. */
function CapabilityStrip() {
  const items = [
    { icon: ShieldCheck, label: t("صلاحيات متعددة الأدوار") },
    { icon: Fingerprint, label: t("سجل تدقيق كامل") },
    { icon: Sparkles, label: t("بحث نصي عربي") },
  ];
  return (
    <ul className="grid grid-cols-3 gap-2">
      {items.map(({ icon: Icon, label }) => (
        <li
          key={label}
          className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-muted/50 px-2 py-2.5 text-center transition-colors duration-150 hover:bg-muted"
        >
          <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
          <span className="text-[10px] font-semibold leading-tight text-muted-foreground">
            {label}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Developer credits — brand marks inline, no extra dependency. */
function DevCredits() {
  useLang();
  // Theme tokens for the same reason as the first-run hint: this sits on
  // `bg-card`, so hardcoded white collapses into the light-mode background.
  const linkClass =
    "rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div className="mt-5 border-t border-border pt-4">
      <p className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-[11px] leading-relaxed text-muted-foreground">
        {t("تم تطوير البرنامج بواسطة")}
        <span className="font-semibold text-foreground">Zidex</span>
        <span aria-hidden className="text-muted-foreground/40">
          ·
        </span>
        <a
          href="mailto:z30432981@gmail.com"
          dir="ltr"
          className="transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          z30432981@gmail.com
        </a>
      </p>
      <p className="mt-1.5 flex items-center justify-center gap-1">
        <a
          href={DEV_TIKTOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("حساب المطور على تيك توك")}
          title="TikTok"
          className={linkClass}
        >
          <TikTokMark className="h-3.5 w-3.5" />
        </a>
        <a
          href={DEV_YOUTUBE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("قناة المطور على يوتيوب")}
          title="YouTube"
          className={linkClass}
        >
          <YouTubeMark className="h-3.5 w-3.5 text-[#FF0000]" />
        </a>
        <a
          href={`mailto:${DEV_EMAIL}`}
          aria-label={t("بريد المطور")}
          title={DEV_EMAIL}
          className={linkClass}
        >
          <MailMark className="h-3.5 w-3.5" />
        </a>
      </p>
    </div>
  );
}

/**
 * Login page tabs: password login (default) + quick user picker.
 *
 * The picker exists because a fresh install ships a single administrator, so
 * without it the first sign-in would be a blind guess at a username. It is
 * only rendered when there is more than one account — once the administrator
 * creates real users the picker becomes redundant clutter, and the segmented
 * control collapses to the password form alone.
 */
export function LoginTabs({ users }: { users: LoginUserOption[] }) {
  const [tab, setTab] = useState<Tab>("password");
  const [selected, setSelected] = useState<LoginUserOption | null>(null);
  useLang(); // re-render when the language toggles

  const showPicker = users.length > 1;

  return (
    <>
      {showPicker && (
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
      )}

      {/* One unified card — both tabs share the same surface */}
      <div className="surface-dialog animate-pop overflow-hidden rounded-2xl border border-border bg-card/80 backdrop-blur-xl">
        {tab === "password" || !showPicker ? (
          <>
            <LoginForm />
            {/* First-run affordance: the seeded administrator's credentials.
                Only shown while the seeded account still carries the default
                password, and it tells the operator to change it. */}
            {users.length === 1 && users[0].role === "admin" && users[0].mustChangePassword === 1 && (
              <div className="space-y-3 px-6 pb-6">
                {/* Theme tokens, not `text-white`. The card is `bg-card`, which is
                    near-white in light mode — white text on it is invisible (the
                    hardcoded white classes here made the whole first-run hint
                    unreadable). Every colour below resolves through the theme. */}
                <div className="rounded-xl border border-border bg-muted/50 px-3.5 py-3 text-[11px] leading-relaxed text-muted-foreground">
                  <p className="mb-1.5 flex items-center gap-1.5 font-semibold text-foreground">
                    <KeyRound className="h-3 w w-3 shrink-0 text-primary" />
                    {t("الحساب الافتراضي عند أول تشغيل")}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    <span dir="ltr" className="tnum font-semibold text-foreground">
                      {users[0].username}
                    </span>
                    <span aria-hidden className="text-muted-foreground/40">
                      ·
                    </span>
                    {t("كلمة المرور")}
                    <DefaultPasswordCopy />
                  </p>
                  <p className="mt-1.5 text-muted-foreground/80">
                    {t("غيّر كلمة المرور فور الدخول — تُطلب تلقائياً.")}
                  </p>
                </div>
                <CapabilityStrip />
              </div>
            )}
          </>
        ) : (
          <>
            <div className="border-b border-border bg-muted/30 px-6 py-3.5">
              <p className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                {selected ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  <UsersRound className="h-3.5 w-3.5" />
                )}
                {selected ? t("أدخل كلمة المرور") : t("اختر المستخدم")}
              </p>
            </div>
            {selected ? (
              <UserPasswordPanel
                key={selected.id}
                user={selected}
                onCancel={() => setSelected(null)}
              />
            ) : (
              <div className="max-h-[320px] divide-y divide-border overflow-y-auto">
                {users.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelected(u)}
                    className="flex w-full items-center gap-4 px-6 py-3.5 text-start transition-colors duration-150 hover:bg-muted/60 active:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <Avatar name={u.name} color={u.avatarColor} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">
                        {u.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {u.jobTitle || t(ROLE_META[u.role]?.label || "") || u.role}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <DevCredits />
    </>
  );
}
