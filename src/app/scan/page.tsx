import { ScanLine, Cpu, ShieldCheck, Camera } from "lucide-react";
import { db } from "@/db";
import { departments, folders, docTypes } from "@/db/schema";
import { asc } from "drizzle-orm";
import { PageHeader, Card } from "@/components/ui";
import { ScannerClient } from "@/components/scanner-client";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const [depts, flds, allDocTypes] = await Promise.all([
    db.select({ id: departments.id, name: departments.name }).from(departments).orderBy(departments.name),
    db.select({ id: folders.id, name: folders.name }).from(folders).orderBy(folders.name),
    db.select({ id: docTypes.id, name: docTypes.name }).from(docTypes).orderBy(asc(docTypes.sortOrder)),
  ]);

  return (
    <div className="animate-fadein">
      <PageHeader
        title="الماسحة الضوئية"
        subtitle="امسح المستندات مباشرة باستخدام الكاميرا أو الطابعة — دعم باركود تلقائي واستخراج OCR"
        icon={<ScanLine className="h-5 w-5" />}
      />

      <ScannerClient departments={depts} folders={flds} docTypes={allDocTypes.map((d) => d.name)} />

      <Card className="mt-6 p-5 sm:p-6">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-foreground">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
            <Cpu className="h-4 w-4" />
          </span>
          كيف يعمل الماسح؟
        </h3>
        <p className="mb-4 text-xs leading-5 text-muted-foreground">ثلاث خطوات من الالتقاط حتى الأرشفة الآمنة — كل المعالجة محلية</p>
        <div className="grid gap-3 sm:grid-cols-2 min-[960px]:grid-cols-3 lg:grid-cols-3">
          <BridgeStep icon={<Camera className="h-5 w-5" />} title="1 · الكاميرا" desc="يتم الوصول إلى الكاميرا المدمجة أو الخلوية مباشرة عبر متصفح الويب باستخدام MediaDevices API." />
          <BridgeStep icon={<ScanLine className="h-5 w-5" />} title="2 · استشعار الباركود" desc="يتم مسح الصورة تلقائياً باستخدام مكتبة ZXing المفتوحة المصدر لاكتشاف الباركود وتعبئة الرقم المرجعي." />
          <BridgeStep icon={<ShieldCheck className="h-5 w-5" />} title="3 · الحفظ الآمن" desc="تُرسل الصورة إلى الخادم الموحّد للتخزين الآمن مع تسجيل تدقيق كامل." />
        </div>
        <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-slate-900 p-4 text-xs leading-6 text-slate-300 ring-1 ring-inset ring-white/10 dark:bg-slate-950">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <p>
            <span className="font-bold text-white">ملاحظة أمان:</span> جميع العمليات تتم في المتصفح ولا تُرسل أي بيانات إلى خوادم خارجية.
            يتم معالجة الصور محلياً باستخدام WebAssembly قبل الإرسال إلى الأرشيف.
          </p>
        </div>
      </Card>
    </div>
  );
}

function BridgeStep({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="group rounded-xl border border-border bg-muted/40 p-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-muted/60 hover:shadow-card">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20 transition-transform duration-200 group-hover:scale-110">
        {icon}
      </span>
      <div className="mt-3 text-sm font-bold text-foreground">{title}</div>
      <p className="mt-1 text-xs leading-6 text-muted-foreground">{desc}</p>
    </div>
  );
}
