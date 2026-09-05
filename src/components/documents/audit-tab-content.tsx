import { timeAgo } from "@/lib/format";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

interface AuditEntry {
  id: number;
  action: string;
  details: string | null;
  userName: string | null;
  createdAt: Date | string;
}

export async function AuditTabContent({ docAudit }: { docAudit: AuditEntry[] }) {
  const lang = await getServerLang();
  return (
    <div className="space-y-2.5 px-1 pb-1 pt-4">
      {docAudit.map((a) => (
        <div key={a.id} className="flex items-start gap-2.5 rounded-xl px-2 py-1.5 text-xs transition hover:bg-muted/50">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-sm" />
          <div className="flex-1">
            <span className="leading-5 text-foreground/80">{a.details || a.action}</span>
            <div className="mt-0.5 text-muted-foreground">
              {a.userName ?? ts(lang, "النظام")} · {timeAgo(a.createdAt)}
            </div>
          </div>
        </div>
      ))}
      {docAudit.length === 0 && <p className="text-xs text-muted-foreground">{ts(lang, "لا يوجد نشاط مسجّل.")}</p>}
    </div>
  );
}
