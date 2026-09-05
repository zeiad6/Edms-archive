import { useMemo } from "react";
import { FileText, X, CheckCircle2 } from "lucide-react";
import { formatBytes } from "@/lib/format";
import type { FileItem } from "./types";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

export function FileItemRow({
  item,
  index,
  busy,
  onRemove,
}: {
  item: FileItem;
  index: number;
  busy: boolean;
  onRemove: (i: number) => void;
}) {
  useLang(); // re-render on language toggle
  const preview = useMemo(() => {
    if (!item.preview) return null;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.preview} alt="" className="h-full w-full object-cover" />;
  }, [item.preview]);

  return (
    <div className="flex items-center gap-3 px-4 py-3 transition hover:bg-primary/[0.04]">
      {/* Thumb */}
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted/70 shadow-sm ring-1 ring-inset ring-border/50">
        {preview ?? <FileText className="h-5 w-5 text-rose-400" />}
      </div>
      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{item.file.name}</div>
        <div className="text-[11px] text-muted-foreground">{formatBytes(item.file.size)}</div>
      </div>
      {/* Progress / Status */}
      <div className="flex shrink-0 items-center gap-2">
        {item.done ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        ) : item.error ? (
          <span className="text-[11px] text-rose-500" title={item.error}>{t("فشل")}</span>
        ) : busy && !item.progress ? null : busy ? (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${item.progress}%` }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-muted-foreground">{item.progress}%</span>
          </div>
        ) : null}
        {!busy && !item.done && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-500 active:scale-90"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
