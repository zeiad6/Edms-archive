import { CheckCircle2, XCircle, Clock, Send } from "lucide-react";
import { submitForApproval } from "@/actions/approvals";
import { formatDate, timeAgo, cn } from "@/lib/format";

interface ApprovalItem {
  id: number;
  status: string;
  comment: string | null;
  responseNote: string | null;
  createdAt: Date | string | null;
  respondedAt: Date | string | null;
  requesterName: string | null;
}

interface ApproverItem {
  id: number;
  name: string;
  avatarColor: string | null;
  jobTitle: string | null;
}

export function ApprovalsTabContent({
  docApprovals,
  approvers,
  canRequest,
  docId,
}: {
  docApprovals: ApprovalItem[];
  approvers: ApproverItem[];
  canRequest: boolean;
  docId: number;
}) {
  return (
    <div className="space-y-3 px-1 pb-1 pt-4">
      {docApprovals.length > 0 ? (
        <div className="space-y-2">
          {docApprovals.map((ar) => {
            const statusMeta =
              ar.status === "approved"
                ? { icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400" }
                : ar.status === "rejected"
                  ? { icon: XCircle, cls: "text-rose-600 dark:text-rose-400" }
                  : { icon: Clock, cls: "text-amber-600 dark:text-amber-400" };
            const StatusIcon = statusMeta.icon;
            return (
              <div key={ar.id} className="rounded-lg bg-muted px-3 py-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <StatusIcon className={cn("h-4 w-4", statusMeta.cls)} />
                  <span className={cn("font-semibold", statusMeta.cls)}>
                    {ar.status === "approved"
                      ? "تمت الموافقة"
                      : ar.status === "rejected"
                        ? "مرفوض"
                        : "بانتظار الموافقة"}
                  </span>
                </div>
                <div className="mt-1.5 space-y-1 text-muted-foreground">
                  <span>
                    بواسطة {ar.requesterName} · {timeAgo(ar.createdAt!)}
                  </span>
                  {ar.comment && <p className="text-foreground/70">ملاحظة: {ar.comment}</p>}
                  {ar.responseNote && (
                    <p className={ar.status === "approved" ? "text-emerald-600/70" : "text-rose-600/70"}>
                      {ar.status === "approved" ? "رد: " : "سبب الرفض: "}
                      {ar.responseNote}
                    </p>
                  )}
                  {ar.respondedAt && (
                    <span className="block text-[10px]">استُجيب: {formatDate(ar.respondedAt)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">لم يُقدّم أي طلب موافقة بعد.</p>
      )}
      {canRequest && (
        <form action={submitForApproval} className="space-y-2 pt-1">
          <input type="hidden" name="documentId" value={docId} />
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">المسؤول عن الموافقة</label>
            <select
              name="assignedToId"
              required
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">اختر مسؤول الموافقة...</option>
              {approvers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.jobTitle ? ` · ${a.jobTitle}` : ""}
                </option>
              ))}
            </select>
          </div>
          <textarea
            name="comment"
            rows={2}
            placeholder="ملاحظة (اختياري)..."
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <Send className="h-4 w-4" />
            تقديم طلب موافقة
          </button>
        </form>
      )}
    </div>
  );
}
