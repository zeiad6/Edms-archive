import type { ComponentType } from "react";
import {
  LayoutDashboard,
  Files,
  UploadCloud,
  FileSpreadsheet,
  ScanLine,
  Building2,
  Users,
  History,
  ShieldCheck,
  FolderTree,
  Settings,
  Layers,
  FileText,
  ClipboardCheck,
  FileCheck,
  Bell,
  Tags,
  BarChart3,
  Search,
  Trash2,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
  badge?: string;
  badgeKey?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Sidebar navigation groups — shared by the shell and any future nav consumers. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "الأرشيف",
    items: [
      { href: "/", label: "لوحة المعلومات", icon: LayoutDashboard, exact: true },
      { href: "/documents", label: "المستندات", icon: Files },
      { href: "/search", label: "بحث متقدم", icon: Search },
      { href: "/upload", label: "رفع مستند", icon: UploadCloud },
      { href: "/import/csv", label: "استيراد CSV", icon: FileSpreadsheet },
      { href: "/scan", label: "الماسحة الضوئية", icon: ScanLine, badge: "جسر" },
      { href: "/analytics", label: "لوحة التحليلات", icon: BarChart3 },
      { href: "/folders", label: "المجلدات", icon: FolderTree },
    ],
  },
  {
    label: "الموافقات والإشعارات",
    items: [
      { href: "/approvals", label: "الموافقات", icon: FileCheck, badgeKey: "approvals" },
      { href: "/notifications", label: "الإشعارات", icon: Bell, badgeKey: "notifications" },
    ],
  },
  {
    label: "الإدارة",
    items: [
      { href: "/departments", label: "الأقسام", icon: Building2 },
      { href: "/users", label: "المستخدمون", icon: Users },
      { href: "/audit", label: "سجل النشاط", icon: History },
      { href: "/tags", label: "الوسوم", icon: Tags },
      { href: "/reports", label: "التقارير", icon: BarChart3 },
      { href: "/trash", label: "سلة المحذوفات", icon: Trash2 },
      { href: "/doc-types", label: "التصنيفات", icon: Layers },
      { href: "/templates", label: "القوالب", icon: FileText },
      { href: "/permissions", label: "الصلاحيات", icon: ShieldCheck },
      { href: "/settings", label: "الإعدادات", icon: Settings },
    ],
  },
];

// Re-exported for callers that referenced the old local names.
export { ClipboardCheck };