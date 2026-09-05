import { UploadCloud, FileSearch, ScanText, Database } from "lucide-react";
import { db } from "@/db";
import { departments, folders, tags, docTypes } from "@/db/schema";
import { desc, asc } from "drizzle-orm";
import { PageHeader, Card } from "@/components/ui";
import { UploadForm } from "@/components/upload-zone";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: UploadCloud, title: "الالتقاط والإدخال", desc: "رفع عبر السحب والإفلات أو من الماسحة الضوئية.", tone: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  { icon: ScanText, title: "المعالجة و OCR", desc: "استخراج النص وتوليد المعاينة وتحويل PDF/A.", tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  { icon: Database, title: "الفهرسة والتخزين", desc: "حفظ الملف في التخزين المحلي وفهرسة النص المستخرج للبحث الكامل.", tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  { icon: FileSearch, title: "البحث والاسترجاع", desc: "بحث فوري وبث آمن للمستند عند الطلب.", tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
];

export default async function UploadPage() {
  const lang = await getServerLang();
  const [depts, flds, allTags, allDocTypes] = await Promise.all([
    db.select({ id: departments.id, name: departments.name }).from(departments).orderBy(departments.name),
    db.select({ id: folders.id, name: folders.name }).from(folders).orderBy(folders.name),
    db.select({ id: tags.id, name: tags.name, color: tags.color }).from(tags).orderBy(tags.name),
    db.select({ id: docTypes.id, name: docTypes.name, color: docTypes.color }).from(docTypes).orderBy(asc(docTypes.sortOrder)),
  ]);

  return (
    <div className="animate-fadein page-stack">
      <PageHeader
        title={ts(lang, "إيداع مستند جديد")}
        subtitle={ts(lang, "ارفع ملف واحد أو عدة ملفات وأكمل بياناتها الوصفية")}
        icon={<UploadCloud className="h-5 w-5" />}
      />
      <UploadForm departments={depts} folders={flds} tags={allTags} docTypes={allDocTypes.map((d) => d.name)} />

      <Card className="p-5 shadow-card sm:p-6">
        <h3 className="section-title mb-5">{ts(lang, "دورة حياة المستند في النظام")}</h3>
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="card-interactive group relative rounded-2xl border border-border bg-muted/40 p-5">
                <div className="mb-3.5 flex items-center justify-between">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm ring-1 ring-inset ring-black/[0.05] transition-transform duration-200 group-hover:scale-110 dark:ring-white/10 ${s.tone}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="tnum text-xs font-extrabold text-muted-foreground/60">0{i + 1}</span>
                </div>
                <div className="text-sm font-bold text-foreground">{s.title}</div>
                <p className="mt-1.5 text-xs leading-6 text-muted-foreground">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
