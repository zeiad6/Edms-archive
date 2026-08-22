"use client";

import { useMemo, useState } from "react";
import { Search, X, ShieldCheck } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ApprovalCard, type ApprovalRow } from "@/components/approvals/approval-card";
import { EmptyState } from "@/components/empty-state";

export default function ApprovalsClient({
  requests,
  isApprover,
  isAdmin,
  currentUserId,
}: {
  requests: ApprovalRow[];
  isApprover: boolean;
  isAdmin: boolean;
  currentUserId: number;
}) {
  const [search, setSearch] = useState("");

  // Only the assigned approver (or an admin) may act on a given request.
  const canActOn = (req: ApprovalRow) => isApprover && (isAdmin || req.assignedToId === currentUserId);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) => {
      const fields = [r.docTitle, r.docNumber, r.requesterName, r.assigneeName, r.comment, r.responseNote];
      return fields.some((f) => f && f.toLowerCase().includes(q));
    });
  }, [requests, search]);

  // Split the filtered list once per filter/search change (single pass, memoized)
  // so tab lists and badges don't re-filter on every render.
  const { pendingReqs, completedReqs } = useMemo(() => {
    const pending: ApprovalRow[] = [];
    const completed: ApprovalRow[] = [];
    for (const r of filtered) {
      (r.status === "pending" ? pending : completed).push(r);
    }
    return { pendingReqs: pending, completedReqs: completed };
  }, [filtered]);

  return (
    <div className="animate-fadein">
      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث في عنوان المستند أو الرقم أو مقدم الطلب أو الملاحظات..."
          className="w-full rounded-xl border border-border bg-muted py-2.5 ps-10 pe-3 text-sm text-foreground outline-none transition focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="relative">
            قيد الانتظار
            {pendingReqs.length > 0 && (
              <span className="ms-2 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                {pendingReqs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed">
            مكتملة
            {completedReqs.length > 0 && (
              <span className="ms-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                {completedReqs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">
            الكل
            {search && <span className="ms-1.5 text-xs text-muted-foreground">({filtered.length})</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {pendingReqs.length === 0 ? (
            <EmptyState icon={ShieldCheck} title={search ? "لا توجد طلبات مطابقة للبحث" : "لا توجد طلبات موافقة معلقة"} description={search ? undefined : "طلبات الاعتماد الجديدة الموجهة إليك تظهر هنا."} />
          ) : (
            <div className="grid gap-4">
              {pendingReqs.map((req) => (
                <ApprovalCard key={req.id} req={req} isApprover={isApprover} canApprove={canActOn(req)} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {completedReqs.length === 0 ? (
            <EmptyState icon={ShieldCheck} title={search ? "لا توجد طلبات مطابقة للبحث" : "لا توجد طلبات مكتملة"} description={search ? undefined : "الطلبات التي تم البت فيها (موافقة/رفض) تظهر هنا."} />
          ) : (
            <div className="grid gap-4">
              {completedReqs.map((req) => (
                <ApprovalCard key={req.id} req={req} isApprover={false} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          {filtered.length === 0 ? (
            <EmptyState icon={ShieldCheck} title={search ? "لا توجد طلبات مطابقة للبحث" : "لا توجد طلبات موافقة"} description={search ? undefined : "جميع طلبات الاعتماد في النظام تظهر هنا."} />
          ) : (
            <div className="grid gap-4">
              {filtered.map((req) => (
                <ApprovalCard
                  key={req.id}
                  req={req}
                  isApprover={isApprover}
                  canApprove={canActOn(req) && req.status === "pending"}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}