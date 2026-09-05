import { ScanLine, Cpu, ShieldCheck, Camera } from "lucide-react";
import { db } from "@/db";
import { departments, folders, docTypes } from "@/db/schema";
import { asc } from "drizzle-orm";
import { PageHeader, Card } from "@/components/ui";
import { ScannerClient } from "@/components/scanner-client";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const lang = await getServerLang();
  const [depts, flds, allDocTypes] = await Promise.all([
    db.select({ id: departments.id, name: departments.name }).from(departments).orderBy(departments.name),
    db.select({ id: folders.id, name: folders.name }).from(folders).orderBy(folders.name),
    db.select({ id: docTypes.id, name: docTypes.name }).from(docTypes).orderBy(asc(docTypes.sortOrder)),
  ]);

  return (
    <div className="animate-fadein page-stack">
      <PageHeader
        title={ts(lang, "الماسحة الضوئية")}
        subtitle={ts(lang, "امسح المستندات مباشرة باستخدام الكاميرا أو الطابعة — دعم باركود تلقائي واستخراج OCR")}
        icon={<ScanLine className="h-5 w-5" />}
      />

      <ScannerClient departments={depts} folders={flds} docTypes={allDocTypes.map((d) => d.name)} />

      <Card className="p-5 shadow-card sm:p-6">
        <h3 className="mb-1 flex items-center gap-2.5 text-sm font-extrabold tracking-tight text-foreground">
          <span className="icon-tile h-9 w-9 rounded-xl">
            <Cpu className="h-4 w-4" />
          </span>{ts(lang, "كيف يعمل الماسح؟")}</h3>
        <p className="section-sub mb-5">{ts(lang, "ثلاث خطوات من الالتقاط حتى الأرشفة الآمنة — كل المعالجة محلية")}</p>
        <div className="grid gap-4 sm:grid-cols-2 min-[960px]:grid-cols-3 lg:grid-cols-3 lg:gap-5">
          <BridgeStep icon={<Camera className="h-5 w-5" />} title={ts(lang, "1 · الكاميرا")} desc="يتم الوصول إلى الكاميرا المدمجة أو الخلوية مباشرة عبر متصفح الويب باستخدام MediaDevices API." />
          <BridgeStep icon={<ScanLine className="h-5 w-5" />} title={ts(lang, "2 · استشعار الباركود")} desc="يتم مسح الصورة تلقائياً باستخدام مكتبة ZXing المفتوحة المصدر لاكتشاف الباركود وتعبئة الرقم المرجعي." />
          <BridgeStep icon={<ShieldCheck className="h-5 w-5" />} title={ts(lang, "3 · الحفظ الآمن")} desc="تُرسل الصورة إلى الخادم الموحّد للتخزين الآمن مع تسجيل تدقيق كامل." />
        </div>
        <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-slate-900 p-4 text-xs leading-6 text-slate-300 ring-1 ring-inset ring-white/10 dark:bg-slate-950">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <p>
            <span className="font-bold text-white">{ts(lang, "ملاحظة أمان:")}</span>{ts(lang, "جميع العمليات تتم في المتصفح ولا تُرسل أي بيانات إلى خوادم خارجية. يتم معالجة الصور محلياً باستخدام WebAssembly قبل الإرسال إلى الأرشيف.")}</p>
        </div>
      </Card>
    </div>
  );
}

function BridgeStep({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="card-interactive group rounded-2xl border border-border bg-muted/40 p-5">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm ring-1 ring-inset ring-primary/20 transition-transform duration-200 group-hover:scale-110">
        {icon}
      </span>
      <div className="mt-3.5 text-sm font-bold text-foreground">{title}</div>
      <p className="mt-1.5 text-xs leading-6 text-muted-foreground">{desc}</p>
    </div>
  );
}
