"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  ChevronDown,
  ShieldCheck,
  PanelRightClose,
  PanelRightOpen,
  Bell,
  UploadCloud,
  LogOut,
  LogIn,
  Loader2,
} from "lucide-react";
import { switchUser, logoutUser } from "@/actions/auth";
import { AppLogo } from "@/components/app-logo";
import { DEV_EMAIL, DEV_NAME, DEV_TIKTOK_URL, DEV_YOUTUBE_URL, MailMark, TikTokMark, YouTubeMark } from "@/components/brand-marks";
import { Avatar } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme-provider";
import { LanguageToggle, useLang } from "@/components/lang-provider";
import { SearchBox, type SearchItem } from "@/components/search-box";
import { CommandPalette, CommandPaletteTrigger } from "@/components/command-palette";
import { NAV_GROUPS, type NavItem } from "@/lib/navigation";
import { ROLE_META, cn } from "@/lib/format";
import { t } from "@/lib/i18n";

interface ShellUser {
  id: number;
  name: string;
  role: string;
  jobTitle?: string | null;
  avatarColor: string;
}

/**
 * Admin user-switch row. Clicking a row opens an inline password field for
 * the target user — same rule as the login picker: the target user's
 * password must be verified before the session switches. The menu stays open
 * so the "الحالي" badge visibly moves to the newly active user after the
 * route refresh; the panel collapses back after a successful switch.
 */
function SwitchRow({ user, isCurrent }: { user: ShellUser; isCurrent: boolean }) {
  const [state, formAction, pending] = useActionState(switchUser, { error: undefined as string | undefined });
  const [open, setOpen] = useState(false);
  const submitted = useRef(false);

  // Close the panel after a successful switch (state without error following
  // an actual submit) so the row collapses back to the list.
  useEffect(() => {
    if (submitted.current && !state?.error) setOpen(false);
    submitted.current = false;
  }, [state]);

  return (
    <form
      action={formAction}
      onSubmit={() => {
        submitted.current = true;
      }}
    >
      <input type="hidden" name="userId" value={user.id} />
      {open ? (
        <div className="border-b border-border/60 px-3 py-2.5">
          <div className="mb-2 flex items-center gap-2">
            <Avatar name={user.name} color={user.avatarColor} size="sm" />
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
              {t("كلمة مرور")} {user.name}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="shrink-0 text-[11px] font-semibold text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("إلغاء")}
            </button>
          </div>
          <input
            name="password"
            type="password"
            required
            autoFocus
            autoComplete="current-password"
            dir="ltr"
            placeholder="••••••••"
            className="h-9 w-full rounded-lg border border-border bg-card px-3 text-left text-sm text-foreground shadow-sm outline-none transition-all duration-150 hover:border-primary/25 focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
          />
          {state?.error && (
            <p role="alert" className="mt-1.5 animate-fadein rounded-lg bg-danger/10 px-2 py-1 text-[11px] font-medium text-danger ring-1 ring-inset ring-danger/20">
              {state.error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
            {pending ? t("جاري التبديل…") : t("دخول")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "flex w-full items-center gap-3 px-3 py-2.5 text-start transition-colors duration-150 hover:bg-muted active:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            isCurrent && "bg-primary/5"
          )}
        >
          <Avatar name={user.name} color={user.avatarColor} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{user.name}</span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {user.jobTitle || t(ROLE_META[user.role]?.label || "")}
            </span>
          </span>
          {isCurrent ? (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              {t("الحالي")}
            </span>
          ) : null}
        </button>
      )}
    </form>
  );
}

function LogoutButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-start text-sm text-red-500 transition-colors duration-150 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:hover:bg-red-950/30"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      {pending ? t("جاري تسجيل الخروج…") : t("تسجيل الخروج")}
    </button>
  );
}

export function Shell({
  currentUser,
  users,
  searchIndex,
  pendingApprovalCount = 0,
  unreadNotificationCount = 0,
  children,
}: {
  currentUser: ShellUser;
  users: ShellUser[];
  searchIndex: SearchItem[];
  pendingApprovalCount?: number;
  unreadNotificationCount?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  useLang(); // re-render the whole shell when the language toggles
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("edms_sidebar") === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("edms_sidebar", collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-0 w-full flex-1">
        {open && (
          <div
            className="fixed inset-0 z-40 animate-fadein bg-slate-950/50 backdrop-blur-sm lg:hidden"
            onClick={() => setOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 start-0 z-50 flex w-[17.5rem] transform flex-col border-e border-border bg-sidebar shadow-card transition-[transform,width,box-shadow] duration-300 ease-in-out lg:static lg:z-40 lg:h-full lg:shrink-0 lg:translate-x-0 lg:shadow-none",
            // Direction-aware slide-out. The sidebar is `fixed start-0`, so
            // `start-0` is the LEFT edge in LTR and the RIGHT edge in RTL, and
            // `translate-x-full` is a physical +100% (always rightward).
            //
            //   LTR  left:0  +  +100% (right)  => lands mid-screen  ✗
            //   RTL  right:0 +  +100% (right)  => off-canvas right ✓
            //
            // So "closed" needs -100% in LTR and +100% in RTL: slide the panel
            // back out through the same edge it entered from. Getting this
            // backwards parks the sidebar across the middle of the page
            // instead of hiding it.
            //
            // Scoped with `max-lg:` because Tailwind emits `ltr:`/`rtl:` after
            // the `lg:` breakpoint, so an unscoped `ltr:-translate-x-full`
            // would beat `lg:translate-x-0` and hide the docked desktop sidebar.
            open
              ? "translate-x-0 shadow-pop"
              : "max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full",
            collapsed && "lg:w-[80px]"
          )}
        >
          <div className="flex h-16 items-center justify-between gap-2 border-b border-border bg-gradient-to-b from-card/60 to-transparent px-4">
            <Link href="/" className="flex items-center gap-3 overflow-hidden">
              <AppLogo size={40} className="shrink-0 rounded-xl shadow-lg shadow-primary/30" />
              <div className={cn("leading-tight transition-opacity", collapsed && "lg:opacity-0 lg:w-0 lg:overflow-hidden")}>
                <div className="whitespace-nowrap text-[15px] font-bold text-foreground">{t("أرشيف")}</div>
                <div className="whitespace-nowrap text-[10px] text-muted-foreground">{t("نظام الأرشفة الإلكتروني")}</div>
              </div>
            </Link>
            <button
              className="rounded-lg p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:hidden"
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-3 py-4">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <div className={cn("px-3 pb-2 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/60", collapsed && "lg:hidden")}>
                  {t(group.label)}
                </div>
                <div className="space-y-1.5">
                  {group.items.map((item) => {
                    const active = isActive(item.href, item.exact);
                    const Icon = item.icon;
                    const dynamicBadge =
                      item.badgeKey === "approvals" && pendingApprovalCount > 0
                        ? String(pendingApprovalCount)
                        : item.badgeKey === "notifications" && unreadNotificationCount > 0
                          ? unreadNotificationCount > 99 ? "99+" : String(unreadNotificationCount)
                          : item.badge;
                    const linkEl = (
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[13px] font-medium transition-all duration-150 hover:-translate-y-px",
                          active ? "bg-gradient-to-l from-primary/[0.14] to-primary/[0.07] font-bold text-primary shadow-sm shadow-primary/10 ring-1 ring-inset ring-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground hover:shadow-sm",
                          collapsed && "lg:justify-center lg:px-0"
                        )}
                      >
                        {active && <span className="absolute start-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-e-full bg-primary shadow-[0_0_10px] shadow-primary/40" />}
                        <Icon className={cn("h-4 w-4 shrink-0 transition-all duration-150 group-hover:scale-110", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                        <span className={cn("flex-1 whitespace-nowrap", collapsed && "lg:hidden")}>{t(item.label)}</span>
                        {dynamicBadge && (
                          <span className={cn(
                            "rounded-md px-1.5 py-0.5 text-[10px] font-bold",
                            item.badgeKey === "approvals"
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : item.badgeKey === "notifications"
                                ? "bg-red-500/15 text-red-600 dark:text-red-400"
                                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                            collapsed && "lg:hidden"
                          )}>
                            {dynamicBadge}
                          </span>
                        )}
                      </Link>
                    );
                    if (!collapsed) return <div key={item.href}>{linkEl}</div>;
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                        <TooltipContent side="left">{t(item.label)}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className={cn("border-t border-border p-3", collapsed && "lg:hidden")}>
            <div className="rounded-xl bg-gradient-to-br from-indigo-950 to-indigo-900 p-3 text-white shadow-md shadow-indigo-950/25 dark:from-slate-900 dark:to-indigo-950">
              <div className="flex items-center gap-2 text-[13px] font-semibold">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                {t("أرشيف مؤسسي آمن")}
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-indigo-100/80">
                {t("تخزين محلي آمن · صلاحيات · تدقيق · بث آمن")}
              </p>
            </div>
            <p className="mt-2 flex items-center justify-center gap-1 text-center text-[10px] leading-relaxed text-muted-foreground/60">
              {t("تم تطوير البرنامج بواسطة")}{" "}
              <span className="font-semibold text-muted-foreground">{DEV_NAME}</span>
              <a
                href={`mailto:${DEV_EMAIL}`}
                aria-label={t("بريد المطور")}
                title={DEV_EMAIL}
                className="rounded-md p-1 text-muted-foreground/70 transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <MailMark className="h-3 w-3" />
              </a>
              <a
                href={DEV_TIKTOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("حساب المطور على تيك توك")}
                title="TikTok"
                className="rounded-md p-1 text-muted-foreground/70 transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <TikTokMark className="h-3 w-3" />
              </a>
              <a
                href={DEV_YOUTUBE_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("قناة المطور على يوتيوب")}
                title="YouTube"
                className="rounded-md p-1 text-muted-foreground/70 transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <YouTubeMark className="h-3 w-3 text-[#FF0000]" />
              </a>
            </p>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="surface-header z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-card/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8 2xl:px-10">
            <button
              className="rounded-lg p-2 text-muted-foreground transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:hidden"
              onClick={() => setOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCollapsed((c) => !c)}
                  className="hidden lg:inline-flex"
                >
                  {collapsed ? <PanelRightOpen className="h-[18px] w-[18px]" /> : <PanelRightClose className="h-[18px] w-[18px]" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{collapsed ? t("توسيع القائمة") : t("طي القائمة")}</TooltipContent>
            </Tooltip>

            <SearchBox index={searchIndex} />

            <div className="flex items-center gap-2">
              <CommandPaletteTrigger />
              <ThemeToggle />
              <LanguageToggle />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" asChild className="relative">
                    <Link href="/notifications">
                      <Bell className="h-[18px] w-[18px]" />
                      {unreadNotificationCount > 0 && (
                        <span className="absolute -top-1.5 -start-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                          {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                        </span>
                      )}
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{t("الإشعارات")}</TooltipContent>
              </Tooltip>
              <Button asChild className="hidden sm:inline-flex">
                <Link href="/upload">
                  <UploadCloud className="h-4 w-4" />
                  {t("رفع مستند")}
                </Link>
              </Button>

              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-xl border border-border bg-card p-1 pe-2 transition-all duration-150 hover:bg-muted active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Avatar name={currentUser.name} color={currentUser.avatarColor} size="sm" />
                  <span className="hidden text-start leading-tight sm:block">
                    <span className="block text-xs font-semibold text-foreground">{currentUser.name}</span>
                    <span className="block text-[10px] text-muted-foreground">{t(ROLE_META[currentUser.role]?.label || "")}</span>
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>

                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    <div className="surface-pop absolute end-0 z-50 mt-2 w-64 animate-pop overflow-hidden rounded-2xl bg-card">
                      {currentUser.role === "admin" && (
                        <>
                          <div className="border-b border-border bg-muted px-4 py-2.5 text-[11px] font-bold tracking-normal text-muted-foreground">
                            {t("تبديل المُشغّل")}
                          </div>
                          <div className="max-h-72 overflow-y-auto py-1">
                            {users.map((u) => (
                              <SwitchRow key={u.id} user={u} isCurrent={u.id === currentUser.id} />
                            ))}
                            <div className="my-1 border-t border-border" />
                          </div>
                        </>
                      )}
                      <div className="max-h-72 overflow-y-auto py-1">
                        <form
                          action={logoutUser}
                          onSubmit={(e) => {
                            // React attaches onSubmit via addEventListener — returning
                            // false does NOT cancel submission (React 17+). Must call
                            // preventDefault when the user cancels the confirmation,
                            // and only close the menu after the user confirms.
                            if (!confirm(t("هل أنت متأكد من تسجيل الخروج؟"))) {
                              e.preventDefault();
                              return;
                            }
                            setMenuOpen(false);
                          }}
                        >
                          <LogoutButton />
                        </form>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-6 2xl:px-10">
            <div className="mx-auto flex min-h-0 w-full max-w-[1800px] flex-1 flex-col">{children}</div>
          </main>
        </div>
      </div>
      <CommandPalette />
    </TooltipProvider>
  );
}
