import { HardDrive } from "lucide-react";
import { Card } from "@/components/ui";
import { formatBytes } from "@/lib/format";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

const QUOTA = 5 * 1024 * 1024 * 1024; // 5 GB demo quota

interface StorageUsageCardProps {
  storage: number;
}

/**
 * Storage usage ring with used percentage and quota summary.
 */
export async function StorageUsageCard({ storage }: StorageUsageCardProps) {
  const lang = await getServerLang();
  const usedPct = Math.min(100, Math.round((storage / QUOTA) * 100));
  return (
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
        <div className="text-sm font-bold text-foreground">{ts(lang, "استخدام التخزين")}</div>
        <div className="tnum mt-1 text-xs text-muted-foreground">
          {ts(lang, "{u} مستخدم من {q}", { u: formatBytes(storage), q: formatBytes(QUOTA) })}
        </div>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
          <HardDrive className="h-3 w-3" />{ts(lang, "تخزين محلي آمن")}</div>
      </div>
    </Card>
  );
}
