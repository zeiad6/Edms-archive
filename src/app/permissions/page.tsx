import { ShieldCheck, Check, X } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { PERMISSIONS, PERMISSION_LABELS, ROLE_LABELS, can } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server";
import { redirect } from "next/navigation";
import type { PermissionKey } from "@/lib/permissions";

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
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "permissions.view")) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <ShieldCheck className="mb-4 h-14 w-14 text-muted-foreground/40" />
        <h1 className="text-xl font-bold text-foreground">لا تملك صلاحية الوصول</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          مصفوفة الصلاحيات متاحة للمديرين ومسؤولي النظام فقط. تواصل مع مدير النظام إذا كنت بحاجة إلى الوصول.
        </p>
      </div>
    );
  }

  const entries = Object.entries(PERMISSIONS) as [PermissionKey, readonly string[]][];
  const groups = groupByCategory(entries);

  return (
    <div className="animate-fadein">
      <PageHeader
        title="الصلاحيات"
        subtitle="مصفوفة صلاحيات الأدوار — تعريف الصلاحيات لكل دور"
        icon={<ShieldCheck className="h-5 w-5" />}
      />

      <div className="space-y-6">
        {groups.map(({ category, permissions }) => (
          <Card key={category} className="overflow-hidden">
            <div className="border-b border-border bg-muted/30 px-5 py-3">
              <h2 className="text-sm font-bold text-foreground">
                {CATEGORY_LABELS[category] ?? category}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-xs font-semibold text-muted-foreground">
                    <th className="px-5 py-3 text-right">الصلاحية</th>
                    {ROLES.map((role) => (
                      <th key={role} className="px-4 py-3 text-center" title={`دور ${ROLE_LABELS[role]}`}>
                        {ROLE_LABELS[role]}
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
                      <td className="px-5 py-3 text-foreground">
                        <div className="font-medium text-sm">{PERMISSION_LABELS[key]}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">{key}</div>
                      </td>
                      {ROLES.map((role) => {
                        const hasIt = allowedRoles.includes(role);
                        return (
                          <td
                            key={role}
                            className="px-4 py-3 text-center"
                            aria-label={`${PERMISSION_LABELS[key]} — ${ROLE_LABELS[role]}: ${hasIt ? "متاح" : "غير متاح"}`}
                          >
                            {hasIt ? (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" title="متاح">
                                <Check className="h-4 w-4" />
                              </span>
                            ) : (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground/40" title="غير متاح">
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
