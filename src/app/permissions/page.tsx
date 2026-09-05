import { ShieldCheck, Check, X } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { PERMISSIONS, PERMISSION_LABELS, ROLE_LABELS, can } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server";
import { redirect } from "next/navigation";
import type { PermissionKey } from "@/lib/permissions";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

export const dynamic = "force-dynamic";

const ROLES = ["admin", "manager", "staff"] as const;

/** Group permission keys by category (prefix before first `.`). */
function groupByCategory(
  entries: [PermissionKey, readonly string[]][],
): { category: string; permissions: [PermissionKey, readonly string[]][] }[] {
  const map = new Map<string, [PermissionKey, readonly string[]][]>();
  for (const [key, roles] of entries) {
    const cat = key.split(".")[0];
    const arr = map.get(cat);
    if (arr) arr.push([key, roles]);
    else map.set(cat, [[key, roles]]);
  }
  return Array.from(map.entries()).map(([category, permissions]) => ({ category, permissions }));
}

const CATEGORY_LABELS: Record<string, string> = {
  documents: "المستندات",
  departments: "الأقسام",
  users: "المستخدمون",
  folders: "المجلدات",
  tags: "الوسوم",
  "doc-types": "التصنيفات",
  templates: "القوالب",
  approvals: "الموافقات",
  settings: "الإعدادات",
  audit: "سجل النشاط",
  reports: "التقارير",
  trash: "سلة المحذوفات",
  permissions: "الصلاحيات",
};

export default async function PermissionsPage() {
  const lang = await getServerLang();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "permissions.view")) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="mb-1 flex h-20 w-20 items-center justify-center rounded-3xl bg-muted text-muted-foreground/50 shadow-card ring-1 ring-inset ring-border">
          <ShieldCheck className="h-10 w-10" />
        </span>
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">{ts(lang, "لا تملك صلاحية الوصول")}</h1>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">{ts(lang, "مصفوفة الصلاحيات متاحة للمديرين ومسؤولي النظام فقط. تواصل مع مدير النظام إذا كنت بحاجة إلى الوصول.")}</p>
      </div>
    );
  }

  const entries = Object.entries(PERMISSIONS) as [PermissionKey, readonly string[]][];
  const groups = groupByCategory(entries);

  return (
    <div className="animate-fadein page-stack">
      <PageHeader
        title={ts(lang, "الصلاحيات")}
        subtitle={ts(lang, "مصفوفة صلاحيات الأدوار — تعريف الصلاحيات لكل دور")}
        icon={<ShieldCheck className="h-5 w-5" />}
      />

      <div className="space-y-5 lg:space-y-6">
        {groups.map(({ category, permissions }) => (
          <Card key={category} className="overflow-hidden shadow-card">
            <div className="border-b border-border bg-gradient-to-b from-muted/50 to-muted/20 px-5 py-3.5 sm:px-6">
              <h2 className="text-sm font-extrabold tracking-tight text-foreground">
                {ts(lang, CATEGORY_LABELS[category] ?? category)}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-xs font-bold text-muted-foreground">
                    <th className="px-5 py-3.5 text-start sm:px-6">{ts(lang, "الصلاحية")}</th>
                    {ROLES.map((role) => (
                      <th key={role} className="px-4 py-3.5 text-center" title={ts(lang, "دور {r}", { r: ts(lang, ROLE_LABELS[role]) })}>
                        {ts(lang, ROLE_LABELS[role])}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {permissions.map(([key, allowedRoles], idx) => (
                    <tr
                      key={key}
                      className={
                        idx % 2 === 0
                          ? "border-b border-border/50"
                          : "border-b border-border/50 bg-muted/10"
                      }
                    >
                      <td className="px-5 py-3.5 text-foreground sm:px-6">
                        <div className="font-semibold text-sm">{ts(lang, PERMISSION_LABELS[key])}</div>
                        <div className="text-[11px] text-muted-foreground mt-1 font-mono" dir="ltr">{key}</div>
                      </td>
                      {ROLES.map((role) => {
                        const hasIt = allowedRoles.includes(role);
                        return (
                          <td
                            key={role}
                            className="px-4 py-3 text-center"
                            aria-label={ts(lang, "{p} — {r}: {s}", { p: ts(lang, PERMISSION_LABELS[key]), r: ts(lang, ROLE_LABELS[role]), s: ts(lang, hasIt ? "متاح" : "غير متاح") })}
                          >
                            {hasIt ? (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" title={ts(lang, "متاح")}>
                                <Check className="h-4 w-4" />
                              </span>
                            ) : (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground/40" title={ts(lang, "غير متاح")}>
                                <X className="h-4 w-4" />
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
