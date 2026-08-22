/* ── Shared labels + filter tabs (notifications page) ───────── */

export const NOTIFICATION_LABELS: Record<string, string> = {
  approval_requested: "طلب موافقة",
  approval_approved: "موافقة",
  approval_rejected: "رفض",
};

export const TYPE_TABS = [
  { value: "", label: "الكل" },
  { value: "approval_requested", label: "طلبات الموافقة" },
  { value: "approval_approved", label: "الموافقات" },
  { value: "approval_rejected", label: "الرفض" },
];

export const READ_TABS = [
  { value: "", label: "الكل" },
  { value: "unread", label: "غير مقروء" },
  { value: "read", label: "مقروءة" },
];
