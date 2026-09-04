import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Cairo, IBM_Plex_Sans_Arabic } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { db } from "@/db";
import { users, documents, departments } from "@/db/schema";
import type { Document } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser, canAccessDocument, getPendingApprovalCount, getUnreadNotificationCount } from "@/lib/server";
import { ensureSeeded } from "@/lib/seed";
import { Shell } from "@/components/shell";
import { ElectronTitleBar } from "@/components/electron-titlebar";
import { Toaster } from "@/components/ui/sonner";
import { LangProvider } from "@/components/lang-provider";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-cairo",
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-plex-arabic",
});

// Applied before first paint to avoid a flash of the wrong theme.
// Day mode is the product default: only an explicit stored 'dark' opts into
// the dark theme — the OS preference is intentionally ignored.
const themeInit = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){console.error('[theme-init]',e)}})();`;

// Applied before first paint to avoid a flash of the wrong language/direction.
// Defaults to Arabic (ar/rtl) — the SSR default in <html lang="ar" dir="rtl">.
const langInit = `(function(){try{var l=localStorage.getItem('lang');if(l==='en'){document.documentElement.lang='en';document.documentElement.dir='ltr';}}catch(e){console.error('[lang-init]',e)}})();`;

export const metadata: Metadata = {
  title: "أرشيف · نظام الأرشفة الإلكترونية EDMS",
  description:
    "منصة أرشفة إلكترونية مؤسسية آمنة: تخزين محلي آمن، بحث متكامل، صلاحيات، تدقيق، وبث آمن للمستندات.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  await ensureSeeded();
  // Wave 1: current user + user directory (needed by both Shell and the queries below).
  const [currentUser, allUsers] = await Promise.all([
    getCurrentUser(),
    db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        jobTitle: users.jobTitle,
        avatarColor: users.avatarColor,
      })
      .from(users),
  ]);

  // Wave 2: shell badges + global search index — one parallel batch
  // (was 3 sequential round-trips). docRows selects only the columns the
  // search index consumes, not the full row (no content_text).
  const [pendingApprovalCount, unreadNotificationCount, docRows] = await Promise.all([
    getPendingApprovalCount(currentUser?.id),
    getUnreadNotificationCount(currentUser?.id),
    currentUser
      ? db
          .select({
            d: {
              id: documents.id,
              title: documents.title,
              docNumber: documents.docNumber,
              docType: documents.docType,
              status: documents.status,
              departmentId: documents.departmentId,
              uploadedById: documents.uploadedById,
              confidential: documents.confidential,
              createdAt: documents.createdAt,
              deletedAt: documents.deletedAt,
            },
            deptName: departments.name,
            deptColor: departments.color,
          })
          .from(documents)
          .leftJoin(departments, eq(documents.departmentId, departments.id))
          .orderBy(desc(documents.createdAt))
          .limit(500)
      : [],
  ]);
  // Build the search index in a single pass over docRows (was filter + map,
  // two passes over up to 500 rows).
  const searchIndex: Array<{
    id: number;
    title: string;
    docNumber: string;
    docType: string;
    status: string;
    departmentName: string;
    departmentColor: string;
  }> = [];
  for (const r of docRows) {
    if (r.d.deletedAt) continue; // soft-deleted docs must not appear in search
    if (!canAccessDocument(currentUser, r.d as unknown as Document)) continue;
    searchIndex.push({
      id: r.d.id,
      title: r.d.title,
      docNumber: r.d.docNumber ?? "",
      docType: r.d.docType ?? "",
      status: r.d.status,
      departmentName: r.deptName ?? "",
      departmentColor: r.deptColor ?? "#94a3b8",
    });
  }

  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${plexArabic.variable}`} suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">{themeInit}</Script>
        <Script id="lang-init" strategy="beforeInteractive">{langInit}</Script>
      </head>
      <body className="bg-background text-foreground antialiased">
        <LangProvider>
          <ElectronTitleBar />
          {currentUser ? (
            <Shell currentUser={currentUser} users={allUsers} searchIndex={searchIndex} pendingApprovalCount={pendingApprovalCount} unreadNotificationCount={unreadNotificationCount}>
              {children}
            </Shell>
          ) : (
            children
          )}
          <Toaster />
        </LangProvider>
      </body>
    </html>
  );
}
