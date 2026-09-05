import { UploadVersion } from "@/components/upload-version";
import { restoreVersion } from "@/actions/versions";
import { formatBytes, timeAgo, cn } from "@/lib/format";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

interface VersionItem {
  v: {
    id: number;
    version: number;
    fileSize: number;
    createdAt: Date | string;
    note: string | null;
  };
  uploaderName: string | null;
}

export async function VersionsTabContent({
  versions,
  docId,
  canWrite,
  currentVersion,
}: {
  versions: VersionItem[];
  docId: number;
  canWrite: boolean;
  currentVersion: number;
}) {
  const lang = await getServerLang();
  return (
    <div className="space-y-3 px-1 pb-1 pt-4">
      <UploadVersion docId={docId} canWrite={canWrite} />
      <div className="space-y-2">
        {versions.map((ver, idx) => {
          const isCurrent = ver.v.version === currentVersion && idx === 0;
          return (
            <div
              key={ver.v.id}
              className={cn(
                "rounded-xl border bg-card px-3.5 py-3 shadow-soft transition hover:shadow-card",
                isCurrent ? "border-primary/30 ring-1 ring-primary/10" : "border-border",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{ts(lang, "الإصدار {n}", { n: ver.v.version })}</span>
                    {isCurrent && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-400">{ts(lang, "الحالي")}</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span className="tnum">{formatBytes(ver.v.fileSize)}</span>
                    {ver.uploaderName && <span>{ts(lang, "بواسطة {n}", { n: ver.uploaderName })}</span>}
                    <span>{timeAgo(ver.v.createdAt)}</span>
                  </div>
                  {ver.v.note && (
                    <div className="mt-1.5 text-xs italic text-muted-foreground/80">&ldquo;{ver.v.note}&rdquo;</div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <a
                    href={`/api/documents/${docId}/versions/${ver.v.id}/file`}
                    download
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10"
                  >{ts(lang, "تنزيل")}</a>
                  {!isCurrent && canWrite && (
                    <form action={restoreVersion}>
                      <input type="hidden" name="documentId" value={docId} />
                      <input type="hidden" name="versionId" value={ver.v.id} />
                      <button
                        type="submit"
                        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-amber-600 transition hover:bg-amber-500/10 dark:text-amber-400"
                      >{ts(lang, "استرجاع")}</button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {versions.length === 0 && <p className="text-xs text-muted-foreground">{ts(lang, "لا توجد إصدارات.")}</p>}
      </div>
    </div>
  );
}
