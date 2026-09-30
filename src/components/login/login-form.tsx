"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  User,
} from "lucide-react";
import { loginUser } from "@/actions/auth";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";
import {
  REMEMBER_KEYS,
  clearSecret,
  readSecret,
  storageTierLabel,
  storeSecret,
} from "@/lib/credential-store";

/** Mirrors the server-side floor in `src/actions/auth.ts` (new password >= 8). */
const MIN_PASSWORD_LENGTH = 8;

const initialState = {
  error: undefined as string | undefined,
  mustChange: false,
  success: undefined as string | undefined,
};

/** Shared field styling: h-11 inputs with icon padding and a refined focus ring. */
const inputClass =
  "h-11 w-full rounded-xl border border-border bg-card pr-10 pl-3 text-left text-sm text-foreground shadow-sm outline-none transition-all duration-150 placeholder:text-muted-foreground/50 hover:border-primary/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/20";

/** Shared primary button styling: full-width, icon + spinner, pressed feedback. */
const submitClass =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-150 hover:bg-primary/90 hover:shadow-primary/35 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60";

/** Danger banner with icon — used by the login and change-password steps. */
function ErrorBanner({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="animate-fadein flex items-start gap-2 rounded-xl bg-danger/10 px-3 py-2.5 text-xs font-medium leading-relaxed text-danger ring-1 ring-inset ring-danger/20"
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

/**
 * Password input with label, leading icon, and a reveal toggle.
 *
 * Uncontrolled when `value`/`onChange` are omitted (change-password step),
 * controlled otherwise. The reveal button is a real `<button type="button">`
 * with `aria-pressed` and a live label, so it is reachable by keyboard and
 * announces its state rather than being a bare icon.
 *
 * `minLength` is the trap this form used to fall into: it was hardcoded to 8,
 * so the confirm field silently blocked submission when the two new passwords
 * disagreed or the user typed something shorter — no message, no server round
 * trip, the form just sat there. Length is now only advisory (`minLengthHint`)
 * and the server is the single authority, so a mismatch produces a real
 * message instead of a dead button.
 */
function PasswordField({
  id,
  name,
  label,
  autoComplete,
  value,
  onChange,
  revealed,
  onToggleReveal,
  minLengthHint,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  value?: string;
  onChange?: (v: string) => void;
  revealed: boolean;
  onToggleReveal: () => void;
  /** Enforce this length in the browser. Omit to leave it to the server. */
  minLengthHint?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <KeyRound className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80" />
        <input
          id={id}
          name={name}
          type={revealed ? "text" : "password"}
          required
          minLength={minLengthHint}
          autoComplete={autoComplete}
          dir="ltr"
          placeholder="••••••••"
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className={cn(inputClass, "pl-11")}
        />
        <button
          type="button"
          onClick={onToggleReveal}
          aria-pressed={revealed}
          aria-label={revealed ? t("إخفاء كلمة المرور") : t("إظهار كلمة المرور")}
          title={revealed ? t("إخفاء كلمة المرور") : t("إظهار كلمة المرور")}
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {minLengthHint ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {t("كلمة المرور يجب ألا تقل عن {n} أحرف", { n: minLengthHint })}
        </p>
      ) : null}
    </div>
  );
}

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Username + password login form (useActionState + pending feedback).
 *
 * Two-step flow for accounts flagged `mustChangePassword`: the first submit
 * returns `{ mustChange: true }` WITHOUT issuing a session, so the form
 * switches to a change-password step (new + confirm). The current password
 * is carried over as a hidden field and re-verified server-side by
 * `loginUser`. On success a confirmation is shown with a button that returns
 * to the login step so the user can sign in with the new password.
 *
 * Remembered credentials: the opt-in checkbox stores the username and password
 * through `@/lib/credential-store`, which uses the OS keychain in the packaged
 * app and AES-GCM in the browser. The record is only written when the user
 * signs in successfully, and unchecking the box on submit destroys it — so
 * "remember me" can never outlive the choice that made it.
 */
export function LoginForm() {
  useLang(); // re-render when the language toggles
  const [state, formAction, pending] = useActionState(loginUser, initialState);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [stage, setStage] = useState<"login" | "change" | "success">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  // Controlled only to drive the live mismatch hint; the server still receives
  // the real form fields on submit.
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  /** Captured on submit so the effect can persist exactly what was submitted. */
  const submitted = useRef<{ username: string; password: string; remember: boolean } | null>(null);

  // Restore a saved record once, on mount. Async because the keychain (Electron
  // IPC) is async; the effect must not re-run per keystroke or it would fight
  // the user's typing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [u, p] = await Promise.all([
          readSecret(REMEMBER_KEYS.username),
          readSecret(REMEMBER_KEYS.password),
        ]);
        if (cancelled) return;
        if (u) setUsername(u);
        if (p) setPassword(p);
        if (u && p) setRemember(true);
      } catch {
        /* unreadable record — start from a clean form */
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Drive the visible step from the action result (transitions only — the
  // success button resets `stage` locally without touching the action state).
  useEffect(() => {
    if (state.success) setStage("success");
    else if (state.mustChange) setStage("change");
  }, [state]);

  // Persist or destroy the remembered record. A `mustChange` result is NOT a
  // successful sign-in (no session was issued), so it must not save anything.
  useEffect(() => {
    if (!state || (!state.success && !state.error)) return;
    const s = submitted.current;
    submitted.current = null;
    if (!s) return;

    if (state.success) {
      if (s.remember) {
        void Promise.all([
          storeSecret(REMEMBER_KEYS.username, s.username),
          storeSecret(REMEMBER_KEYS.password, s.password),
        ]);
      } else {
        void clearSecret(REMEMBER_KEYS.username);
        void clearSecret(REMEMBER_KEYS.password);
      }
    } else if (state.mustChange) {
      // The password is about to change; the saved copy is stale by definition.
      void clearSecret(REMEMBER_KEYS.password);
      setRemember(false);
    }
  }, [state]);

  const capture = () => {
    submitted.current = { username, password, remember };
  };

  if (stage === "success") {
    return (
      <div className="space-y-4 p-6">
        <p
          role="status"
          className="animate-fadein flex items-start gap-2 rounded-xl bg-success/10 px-3 py-2.5 text-xs font-medium leading-relaxed text-success ring-1 ring-inset ring-success/20"
        >
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{state.success}</span>
        </p>
        <button
          type="button"
          onClick={() => {
            setStage("login");
            setPassword("");
            setShowPassword(false);
            setNewPassword("");
            setConfirmPassword("");
          }}
          className={submitClass}
        >
          <Lock className="h-4 w-4" />
          {t("تسجيل الدخول")}
        </button>
      </div>
    );
  }

  if (stage === "change") {
    return (
      <form
        action={formAction}
        className="space-y-4 p-6"
        onSubmit={capture}
      >
        {/* Current credentials, re-verified server-side by loginUser. */}
        <input type="hidden" name="username" value={username} />
        <input type="hidden" name="password" value={password} />

        <p className="rounded-xl bg-primary/[0.06] px-3 py-2.5 text-xs leading-relaxed text-muted-foreground ring-1 ring-inset ring-primary/15">
          {t("لأمان الحساب، عيّن كلمة مرور جديدة قبل المتابعة.")}
        </p>

      <div className="space-y-4">
        <PasswordField
          id="login-new-password"
          name="newPassword"
          label={t("كلمة المرور الجديدة")}
          autoComplete="new-password"
          value={newPassword}
          onChange={setNewPassword}
          revealed={showNew}
          onToggleReveal={() => setShowNew((v) => !v)}
          minLengthHint={MIN_PASSWORD_LENGTH}
        />
        <PasswordField
          id="login-confirm-password"
          name="confirmPassword"
          label={t("تأكيد كلمة المرور")}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          revealed={showConfirm}
          onToggleReveal={() => setShowConfirm((v) => !v)}
        />
        {/* Live mismatch hint. The confirm field is no longer gated by the
            browser's minLength/validation, so this is what tells the user why
            the submit did nothing before. */}
        {newPassword && newPassword !== confirmPassword ? (
          <p
            role="status"
            className="flex items-center gap-1.5 text-[11px] font-medium text-danger"
          >
            <AlertCircle className="h-3 w-3 shrink-0" />
            {t("كلمتا المرور غير متطابقتين")}
          </p>
        ) : null}
        {newPassword && confirmPassword && newPassword === confirmPassword ? (
          <p
            role="status"
            className="flex items-center gap-1.5 text-[11px] font-medium text-success"
          >
            <CheckCircle2 className="h-3 w-3 shrink-0" />
            {t("كلمتا المرور متطابقتان")}
          </p>
        ) : null}
      </div>

        {state?.error && <ErrorBanner message={state.error} />}

        <button type="submit" disabled={pending} className={submitClass}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {pending ? t("جاري الحفظ…") : t("تغيير كلمة المرور")}
        </button>
      </form>
    );
  }

  return (
    <form action={formAction} className="space-y-4 p-6" onSubmit={capture}>
      <div>
        <label htmlFor="login-username" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
          {t("اسم المستخدم")}
        </label>
        <div className="relative">
          <User className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80" />
          <input
            id="login-username"
            name="username"
            type="text"
            required
            autoComplete="username"
            autoCapitalize="none"
            dir="ltr"
            placeholder="admin"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <PasswordField
        id="login-password"
        name="password"
        label={t("كلمة المرور")}
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
        revealed={showPassword}
        onToggleReveal={() => setShowPassword((v) => !v)}
      />

      {/* Opt-in remember. `hydrated` keeps the checkbox from flashing on/off
          during the async restore, which would read as the app forgetting
          something the user had saved. */}
      {hydrated && (
        <label className="flex cursor-pointer select-none items-center gap-2.5 rounded-xl bg-muted/40 px-3 py-2.5 transition-colors hover:bg-muted/60">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 shrink-0 rounded border-border text-primary accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
              {t("حفظ بيانات الدخول على هذا الجهاز")}
            </span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
              {storageTierLabel(t)}
            </span>
          </span>
        </label>
      )}

      {state?.error && <ErrorBanner message={state.error} />}

      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        {pending ? t("جاري تسجيل الدخول…") : t("تسجيل الدخول")}
      </button>
    </form>
  );
}
