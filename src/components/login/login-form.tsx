"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, KeyRound, Loader2, Lock, User } from "lucide-react";
import { loginUser } from "@/actions/auth";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

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
 * Password input with label + leading icon. Uncontrolled when `value`/
 * `onChange` are omitted (change-password step), controlled otherwise.
 */
function PasswordField({
  id,
  name,
  label,
  autoComplete,
  value,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  value?: string;
  onChange?: (v: string) => void;
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
          type="password"
          required
          minLength={8}
          autoComplete={autoComplete}
          dir="ltr"
          placeholder="••••••••"
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className={inputClass}
        />
      </div>
    </div>
  );
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
 */
export function LoginForm() {
  useLang(); // re-render when the language toggles
  const [state, formAction, pending] = useActionState(loginUser, initialState);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [stage, setStage] = useState<"login" | "change" | "success">("login");

  // Drive the visible step from the action result (transitions only — the
  // success button resets `stage` locally without touching the action state).
  useEffect(() => {
    if (state.success) setStage("success");
    else if (state.mustChange) setStage("change");
  }, [state]);

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
      <form action={formAction} className="space-y-4 p-6">
        {/* Current credentials, re-verified server-side by loginUser. */}
        <input type="hidden" name="username" value={username} />
        <input type="hidden" name="password" value={password} />

        <PasswordField
          id="login-new-password"
          name="newPassword"
          label={t("كلمة المرور الجديدة")}
          autoComplete="new-password"
        />
        <PasswordField
          id="login-confirm-password"
          name="confirmPassword"
          label={t("تأكيد كلمة المرور")}
          autoComplete="new-password"
        />

        {state?.error && <ErrorBanner message={state.error} />}

        <button type="submit" disabled={pending} className={submitClass}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {pending ? t("جاري الحفظ…") : t("تغيير كلمة المرور")}
        </button>
      </form>
    );
  }

  return (
    <form action={formAction} className="space-y-4 p-6">
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
            placeholder="k.alomari"
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
      />

      {state?.error && <ErrorBanner message={state.error} />}

      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        {pending ? t("جاري تسجيل الدخول…") : t("تسجيل الدخول")}
      </button>
    </form>
  );
}