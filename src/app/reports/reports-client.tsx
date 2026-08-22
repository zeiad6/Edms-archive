"use client";

import { useMemo, useState } from "react";
import type { ReportsData } from "@/lib/reports";
import { DeptSection } from "@/components/reports/dept-section";
import { TypeSection } from "@/components/reports/type-section";
import { StatusSection } from "@/components/reports/status-section";
import { TrendSection } from "@/components/reports/trend-section";
import { UserSection } from "@/components/reports/user-section";
import { DateRangeFilter } from "@/components/reports/filter-controls";

export function ReportsClient({ data }: { data: ReportsData }) {
  const { totalDocs, docsByDept, docsByUser, byType, byStatus, monthly } = data;

  /* Search states */
  const [deptQ, setDeptQ] = useState("");
  const [typeQ, setTypeQ] = useState("");
  const [userQ, setUserQ] = useState("");

  /* Date range filter for monthly chart */
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(monthly.length - 1);

  /* Filtered data */
  const filteredDepts = useMemo(
    () =>
      deptQ
        ? docsByDept.filter((d) => (d.deptName ?? "").includes(deptQ))
        : docsByDept,
    [docsByDept, deptQ],
  );

  const filteredTypes = useMemo(
    () => (typeQ ? byType.filter((t) => t.type.includes(typeQ)) : byType),
    [byType, typeQ],
  );

  const filteredUsers = useMemo(
    () =>
      userQ
        ? docsByUser.filter((u) => (u.userName ?? "").includes(userQ))
        : docsByUser,
    [docsByUser, userQ],
  );

  const filteredMonthly = useMemo(
    () => monthly.slice(Math.max(0, fromIdx), toIdx + 1),
    [monthly, fromIdx, toIdx],
  );

  return (
    <>
      {/* ── Filter Controls ── */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <DateRangeFilter
          monthly={monthly}
          fromIdx={fromIdx}
          toIdx={toIdx}
          show={showDateFilter}
          onToggle={() => setShowDateFilter((p) => !p)}
          onFrom={setFromIdx}
          onTo={setToIdx}
        />
      </div>

      {/* ── Department breakdown ── */}
      <DeptSection
        depts={filteredDepts}
        totalDocs={totalDocs}
        search={deptQ}
        onSearch={setDeptQ}
      />

      {/* ── Type breakdown ── */}
      {filteredTypes.length > 0 && (
        <TypeSection types={filteredTypes} search={typeQ} onSearch={setTypeQ} />
      )}

      {/* ── Status distribution ── */}
      {byStatus.length > 0 && (
        <StatusSection statuses={byStatus} totalDocs={totalDocs} />
      )}

      {/* ── Monthly trend ── */}
      {filteredMonthly.length > 1 && (
        <TrendSection monthly={filteredMonthly} />
      )}

      {/* ── User activity ── */}
      <UserSection users={filteredUsers} search={userQ} onSearch={setUserQ} />
    </>
  );
}