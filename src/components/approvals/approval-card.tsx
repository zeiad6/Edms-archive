"use client";

import Link from "next/link";
import { FileText, CheckCircle2, XCircle, Clock, MessageSquare, ArrowUpRight } from "lucide-react";
import { Card, Avatar, StatusBadge } from "@/components/ui";
import { formatDate, timeAgo, cn } from "@/lib/format";
import { approveDocument, rejectDocument } from "@/actions/approvals";

export interface ApprovalRow {
  id: number;
  documentId: number;
  assignedToId: number;
  status: string;
  comment: string | null;
  responseNote: string | null;
  createdAt: string | null;
  respondedAt: string | null;
  docTitle: string;
  docNumber: string | null;
  docStatus: string;
  requesterName: string;
  requesterColor: string;
  requesterTitle: string | null;
  assigneeName: string | null;
  assigneeColor: string | null;
}

const STATUS_STYLES: Record<string, { label: string; icon: typeof Clock; classes: string }> = {
  pending: {
    label: "بانتظار الموافقة",
    icon: Clock,
    classes: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  approved: {
    label: "تمت الموافقة",
    icon: CheckCircle2,
    classes: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  rejected: {
    label: "مرفوض",
    icon: XCircle,
    classes: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
};

interface ApprovalCardProps {
  req: ApprovalRow;
  isApprover: boolean;
  canApprove?: boolean;
}

/** Single approval request card: metadata + approve/reject actions. */
export function ApprovalCard({ req, isApprover, canApprove }: ApprovalCardProps) {
  const st = STATUS_STYLES[req.status] ?? STATUS_STYLES.pending;
  const StatusIcon = st.icon;

  return (
    <Card className="overflow-hidden transition hover:shadow-md">
      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", st.classes)}>
              <StatusIcon className="h-3.5 w-3.5" />
              {st.label}
            </span>
            <StatusBadge status={req.docStatus} />
          </div>

          {/* Document title */}
          <Link
            href={`/documents/${req.documentId}`}
            className="group inline-flex items-center gap-1.5 text-base font-bold text-foreground hover:text-primary"
          >
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span>{req.docTitle}</span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:opacity-100" />
          </Link>
          {req.docNumber && (
            <span className="block text-xs text-muted-foreground">رقم المستند: {req.docNumber}</span>
          )}

          {/* Requester */}
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
            <Avatar name={req.requesterName} color={req.requesterColor} size="sm" />
            <span className="text-sm">
              <span className="font-medium text-foreground">{req.requesterName}</span>
              {req.requesterTitle && (
                <span className="ms-1 text-xs text-muted-foreground">· {req.requesterTitle}</span>
              )}
            </span>
          </div>

          {/* Assignee */}
          {req.assigneeName && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
              <Avatar name={req.assigneeName} color={req.assigneeColor ?? "#64748b"} size="sm" />
              <span className="text-sm">
                <span className="font-medium text-foreground">{req.assigneeName}</span>
                <span className="ms-1 text-xs text-muted-foreground">· المُسنَد إليه</span>
              </span>
            </div>
          )}

          {/* Comment */}
          {req.comment && (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-sm leading-relaxed text-muted-foreground">{req.comment}</p>
            </div>
          )}

          {/* Response note */}
          {req.responseNote && (
            <div className={cn(
              "flex items-start gap-2 rounded-lg border px-3 py-2.5",
              req.status === "approved"
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
                : "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30",
            )}>
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs font-semibold text-foreground">
                  {req.status === "approved" ? "رد الموافقة" : "سبب الرفض"}
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">{req.responseNote}</p>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span>{req.createdAt ? `أُرسل: ${timeAgo(req.createdAt)}` : "أُرسل: —"}</span>
            {req.respondedAt && <span>استُجيب: {formatDate(req.respondedAt)}</span>}
          </div>
        </div>

        {/* Actions */}
        {canApprove && (
          <div className="flex shrink-0 flex-col gap-2 lg:w-56">
            <form action={approveDocument} className="w-full">
              <input type="hidden" name="requestId" value={req.id} />
              <div className="flex flex-col gap-2">
                <input
                  name="responseNote"
                  placeholder="ملاحظة (اختياري)..."
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  اعتماد
                </button>
              </div>
            </form>
            <form action={rejectDocument} className="w-full">
              <input type="hidden" name="requestId" value={req.id} />
              <div className="flex flex-col gap-2">
                <input
                  name="responseNote"
                  placeholder="سبب الرفض..."
                  required
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-card px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/30"
                >
                  <XCircle className="h-4 w-4" />
                  رفض
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </Card>
  );
}