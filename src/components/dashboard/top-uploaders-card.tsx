import { Medal } from "lucide-react";
import { Card } from "@/components/ui";
import { EmptyState } from "@/components/empty-state";
import { initials } from "@/lib/format";

interface TopUploadersCardProps {
  uploaders: Array<{ name: string; avatarColor: string; c: number }>;
  total: number;
}

/**
 * Top 5 uploaders with avatar initials and counts.
 */
export function TopUploadersCard({ uploaders, total }: TopUploadersCardProps) {
  return (
    <Card className="p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
        <Medal className="h-4 w-4 text-primary" /> أكثر المستخدمين إيداعاً
      </h3>
      {uploaders.length === 0 ? (
        <EmptyState compact icon={Medal} title="لا يوجد إيداعات بعد" description="عند إيداع المستندات تظهر قائمة أكثر المساهمين." />
      ) : (
      <div className="flex flex-wrap gap-3">
        {uploaders.map((u, i) => (
          <div
            key={u.name}
            className="flex min-w-[180px] flex-1 items-center gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3 transition-all duration-150 hover:border-primary/25 hover:bg-muted"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: u.avatarColor }}
            >
              {initials(u.name)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">{u.name}</div>
              <div className="text-xs text-muted-foreground">
                {u.c} مستند{u.c === 1 ? "" : "ات"}
                {i === 0 && total > 0 && <span className="ms-1 font-bold text-amber-500">🥇</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
      )}
    </Card>
  );
}
