import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/server";
import { LoginHeader } from "@/components/login/login-header";
import { LoginTabs } from "@/components/login/login-tabs";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const lang = await getServerLang();
  const user = await getCurrentUser();
  if (user) redirect("/");

  // Portable runtime ONLY (EDMS_PORTABLE=1 is set by electron/main.cjs for the
  // portable exe; Setup installs and dev run with "0"/unset): light token
  // theme matching the app default. Any other runtime keeps the dark backdrop.
  const portableLight = process.env.EDMS_PORTABLE === "1";

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      jobTitle: users.jobTitle,
      avatarColor: users.avatarColor,
    })
    .from(users)
    .orderBy(users.name);

  if (allUsers.length === 0) {
    return (
      <div className={`relative flex min-h-screen items-center justify-center overflow-hidden p-4 ${portableLight ? "bg-background" : "bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950"}`}>
        <div className={`pointer-events-none absolute -top-40 right-1/2 h-[28rem] w-[28rem] translate-x-1/2 rounded-full blur-3xl ${portableLight ? "bg-primary/[0.12]" : "bg-primary/20"}`} />
        <div className={`pointer-events-none absolute -bottom-44 -left-24 h-96 w-96 rounded-full blur-3xl ${portableLight ? "bg-primary/[0.08]" : "bg-violet-600/15"}`} />
        <div className={`animate-fadein relative rounded-2xl border px-8 py-10 text-center backdrop-blur-xl ${portableLight ? "border-border bg-card/85 shadow-card" : "border-white/10 bg-card/80 shadow-2xl shadow-slate-950/50"}`}>
          <Inbox className="mx-auto mb-3 h-10 w-10 text-primary" />
          <p className="text-sm text-muted-foreground">{ts(lang, "لم يتم العثور على أي مستخدمين.")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative flex min-h-screen items-center justify-center overflow-hidden p-4 ${portableLight ? "bg-background" : "bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950"}`}>
      {/* Decorative glows — deeper, more premium backdrop */}
      <div className={`pointer-events-none absolute -top-40 right-1/2 h-[28rem] w-[28rem] translate-x-1/2 rounded-full blur-3xl ${portableLight ? "bg-primary/[0.12]" : "bg-primary/20"}`} />
      <div className={`pointer-events-none absolute -bottom-44 -left-24 h-96 w-96 rounded-full blur-3xl ${portableLight ? "bg-primary/[0.08]" : "bg-violet-600/15"}`} />
      <div className={`pointer-events-none absolute left-1/4 top-1/3 h-72 w-72 rounded-full blur-3xl ${portableLight ? "bg-primary/[0.06]" : "bg-indigo-500/10"}`} />
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent to-transparent ${portableLight ? "via-white/70" : "via-white/20"}`} />
      <div className="animate-fadein relative w-full max-w-md">
        <LoginHeader light={portableLight} />

        <LoginTabs users={allUsers} light={portableLight} />
      </div>
    </div>
  );
}