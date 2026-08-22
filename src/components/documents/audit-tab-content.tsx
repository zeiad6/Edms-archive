import { timeAgo } from "@/lib/format";

interface AuditEntry {
  id: number;
  action: string;
  details: string | null;
  userName: string | null;
  createdAt: Date | string;
}

export function AuditTabContent({ docAudit }: { docAudit: AuditEntry[] }) {
  return (
    <div className="space-y-2.5 px-1 pb-1 pt-4">
      {docAudit.map((a) => (
        <div key={a.id} className="flex items-start gap-2 text-xs">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <div className="flex-1">
            <span className="text-muted-foreground">{a.details || a.action}</span>
            <div className="text-muted-foreground">
              {a.userName ?? "النظام"} · {timeAgo(a.createdAt)}
            </div>
          </div>
        </div>
      ))}
      {docAudit.length === 0 && <p className="text-xs text-muted-foreground">لا يوجد نشاط مسجّل.</p>}
    </div>
  );
}
