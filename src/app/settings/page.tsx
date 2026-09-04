import {
  Settings as SettingsIcon,
  Files,
  Users,
  Building2,
  HardDrive,
  Database,
  ShieldCheck,
  Layers,
  Code2,
} from "lucide-react";
import { db } from "@/db";
import { documents, users, departments, folders } from "@/db/schema";
import { count, sql } from "drizzle-orm";
import { PageHeader, Card, StatCard } from "@/components/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AppearanceSettings } from "@/components/appearance-settings";
import { BackupRestoreCard } from "@/components/settings/backup-restore-card";
import { getCurrentUser } from "@/lib/server";
import { can } from "@/lib/permissions";
import { formatBytes } from "@/lib/format";

export const dynamic = "force-dynamic";

const QUOTA = 5 * 1024 * 1024 * 1024;

const STACK = [
  { name: "Next.js (App Router)", role: "إطار الواجهة والخادم" },
  { name: "libSQL (SQLite) + Drizzle", role: "قاعدة البيانات المحلية و ORM" },
  { name: "Tailwind CSS v4", role: "التصميم والثيمات" },
  { name: "Shadcn UI / Radix", role: "مكونات الواجهة" },
  { name: "AG Grid + DataTables", role: "جداول السجلات" },
  { name: "Fuse.js + Mark.js", role: "البحث الذكي والتلوين" },
];

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const isAdmin = !!user && can(user, "settings.manage");

  const [docRow, userRow, deptRow, folderRow, sizeRow] = await Promise.all([
    db.select({ c: count() }).from(documents),
    db.select({ c: count() }).from(users),
    db.select({ c: count() }).from(departments),
    db.select({ c: count() }).from(folders),
    db.select({ size: sql<string>`coalesce(sum(${documents.fileSize}), 0)` }).from(documents),
  ]);

  const storage = Number(sizeRow[0]?.size ?? 0);
  const usedPct = Math.min(100, Math.round((storage / QUOTA) * 100));

  return (
    <div className="animate-fadein">
      <PageHeader
        title="الإعدادات"
        subtitle="نظرة عامة على النظام، تفضيلات المظهر، ومعلومات البنية"
        icon={<SettingsIcon className="h-5 w-5" />}
      />

      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          <TabsTrigger value="appearance">المظهر</TabsTrigger>
          <TabsTrigger value="system">النظام</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={<Files className="h-5 w-5" />} label="المستندات" value={docRow[0]?.c ?? 0} accent="indigo" />
            <StatCard icon={<Users className="h-5 w-5" />} label="المستخدمون" value={userRow[0]?.c ?? 0} accent="violet" />
            <StatCard icon={<Building2 className="h-5 w-5" />} label="الأقسام" value={deptRow[0]?.c ?? 0} accent="emerald" />
            <StatCard icon={<Layers className="h-5 w-5" />} label="المجلدات" value={folderRow[0]?.c ?? 0} accent="amber" />
          </div>

          <Card className="p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
              <Layers className="h-4 w-4 text-primary" /> حزمة التقنيات
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {STACK.map((s) => (
                <div key={s.name} className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card text-primary ring-1 ring-border">
                    <Database className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{s.name}</div>
                    <div className="text-[11px] text-muted-foreground">{s.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card className="p-5">
            <h3 className="mb-1 text-sm font-bold text-foreground">المظهر</h3>
            <p className="mb-4 text-xs text-muted-foreground">اختر مظهر الواجهة. يُحفظ الاختيار على جهازك ويُطبّق فوراً.</p>
            <AppearanceSettings />
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-5">
          <Card className="flex items-center gap-5 p-5">
            <div
              className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(var(--primary) ${usedPct * 3.6}deg, var(--muted) 0deg)` }}
            >
              <div className="flex h-[72px] w-[72px] flex-col items-center justify-center rounded-full bg-card">
                <span className="text-lg font-bold text-foreground">{usedPct}%</span>
              </div>
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">استخدام التخزين الكائني</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatBytes(storage)} مستخدم من {formatBytes(QUOTA)}
              </div>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-3 w-3" /> تخزين محلي آمن · صلاحيات · تدقيق · بث آمن
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
              <HardDrive className="h-4 w-4 text-primary" /> معلومات النظام
            </h3>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <Info k="إصدار النظام" v="EDMS 1.0" />
              <Info k="المحرك" v="Next.js App Router + API Routes" />
              <Info k="قاعدة البيانات" v="libSQL (SQLite) — ملف محلي" />
              <Info k="البحث" v="Fuse.js · SQL LIKE (بحث نصي)" />
              <Info k="الجداول" v="AG Grid" />
              <Info k="الواجهة" v="React 19.2 · Shadcn UI" />
            </dl>
          </Card>

          {isAdmin && <BackupRestoreCard />}

          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
              <Code2 className="h-4 w-4 text-primary" /> حول البرنامج
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              نظام إدارة وثائق إلكترونية: حفظ آمن على التخزين المحلي، بحث نصي (سريع وكامل)،
              صلاحيات متعددة الأدوار، سجل تدقيق، ونسخ احتياطي شامل.
            </p>
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Code2 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">أرشيف — نظام الأرشفة الإلكتروني</div>
                <div className="text-xs text-muted-foreground">
                  مشروع مفتوح المصدر — الإصدار 1.0.0
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium text-foreground">{v}</dd>
    </div>
  );
}
