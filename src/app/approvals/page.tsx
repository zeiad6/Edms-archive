import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { approvalRequests, documents, users } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { getCurrentUser } from "@/lib/server";
import { can } from "@/lib/permissions";
import { ensureSeeded } from "@/lib/seed";
import { PageHeader } from "@/components/ui";
import ApprovalsClient from "@/components/approvals-client";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  await ensureSeeded();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Role-scoped visibility: staff see only their own requests; managers see
  // requests from their department plus ones assigned to them; admins see all.
  const where =
    user.role === "admin"
      ? undefined
      : user.role === "manager"
        ? sql`${documents.departmentId} = ${user.departmentId} OR ${approvalRequests.assignedToId} = ${user.id}`
        : eq(approvalRequests.requestedById, user.id);

  // Single query with aliased self-joins: requester + assignee names resolved
  // in one round-trip (was 2 sequential queries).
  const requester = alias(users, "requester");
  const assignee = alias(users, "assignee");

  const rows = await db
    .select({
      id: approvalRequests.id,
      documentId: approvalRequests.documentId,
      assignedToId: approvalRequests.assignedToId,
      status: approvalRequests.status,
      comment: approvalRequests.comment,
      responseNote: approvalRequests.responseNote,
      createdAt: approvalRequests.createdAt,
      respondedAt: approvalRequests.respondedAt,
      docTitle: documents.title,
      docNumber: documents.docNumber,
      docStatus: documents.status,
      requesterId: approvalRequests.requestedById,
      requesterName: requester.name,
      requesterColor: requester.avatarColor,
      requesterTitle: requester.jobTitle,
      assigneeName: assignee.name,
      assigneeColor: assignee.avatarColor,
    })
    .from(approvalRequests)
    .innerJoin(documents, eq(approvalRequests.documentId, documents.id))
    .innerJoin(requester, eq(approvalRequests.requestedById, requester.id))
    .leftJoin(assignee, eq(approvalRequests.assignedToId, assignee.id))
    .where(where)
    .orderBy(desc(approvalRequests.createdAt))
    .limit(200);

  const isApprover = !!(user && can(user, "approvals.manage"));
  const isAdmin = user.role === "admin";

  return (
    <div className="animate-fadein">
      <PageHeader
        title="الموافقات"
        subtitle="إدارة طلبات الموافقة على المستندات"
        icon={<ShieldCheck className="h-5 w-5" />}
      />
      <ApprovalsClient
        requests={rows}
        isApprover={isApprover}
        isAdmin={isAdmin}
        currentUserId={user.id}
      />
    </div>
  );
}
