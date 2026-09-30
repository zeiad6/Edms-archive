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

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      jobTitle: users.jobTitle,
      avatarColor: users.avatarColor,
      // The picker and the first-run hint key off these two: `username` is the
      // credential the operator has to type, and `mustChangePassword` decides
      // whether the first-run credentials block is still relevant (it must not
      // keep showing after the admin has replaced the default).
      username: users.username,
      mustChangePassword: users.mustChangePassword,
    })
    .from(users)
    .orderBy(users.name);

  if (allUsers.length === 0) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 p-4">
        <div className="pointer-events-none absolute -top-40 right-1/2 h-[28rem] w-[28rem] translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-44 -left-24 h-96 w-96 rounded-full bg-violet-600/15 blur-3xl" />
        <div className="animate-fadein relative rounded-2xl border border-white/10 bg-card/80 px-8 py-10 text-center shadow-2xl shadow-slate-950/50 backdrop-blur-xl">
          <Inbox className="mx-auto mb-3 h-10 w-10 text-primary" />
          <p className="text-sm text-muted-foreground">{ts(lang, "لم يتم العثور على أي مستخدمين.")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 p-4">
      {/* Decorative glows — deeper, more premium backdrop */}
      <div className="pointer-events-none absolute -top-40 right-1/2 h-[28rem] w-[28rem] translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-44 -left-24 h-96 w-96 rounded-full bg-violet-600/15 blur-3xl" />
      <div className="pointer-events-none absolute left-1/4 top-1/3 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-white/20 to-transparent" />
      <div className="animate-fadein relative w-full max-w-md">
        <LoginHeader />

        <LoginTabs users={allUsers} />
      </div>
    </div>
  );
}