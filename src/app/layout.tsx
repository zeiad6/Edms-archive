import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Cairo, IBM_Plex_Sans_Arabic } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { getCurrentUser, getPendingApprovalCount, getUnreadNotificationCount } from "@/lib/server";
import { Shell } from "@/components/shell";
import { ElectronTitleBar } from "@/components/electron-titlebar";
import { Toaster } from "@/components/ui/sonner";
import { LangProvider } from "@/components/lang-provider";
import { getServerLang } from "@/lib/server-lang";

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

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang();
  return {
    title: lang === "en" ? "Archive · EDMS Electronic Archive System" : "أرشيف · نظام الأرشفة الإلكترونية EDMS",
    description:
      lang === "en"
        ? "Secure institutional electronic-archive platform: safe local storage, integrated search, permissions, audit, and secure document streaming."
        : "منصة أرشفة إلكترونية مؤسسية آمنة: تخزين محلي آمن، بحث متكامل، صلاحيات، تدقيق، وبث آمن للمستندات.",
    icons: {
      icon: "/icon.svg",
      shortcut: "/icon.svg",
      apple: "/icon.svg",
    },
  };
}

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [serverLang, currentUser] = await Promise.all([
    getServerLang(),
    getCurrentUser(),
  ]);

  const [pendingApprovalCount, unreadNotificationCount] = currentUser
    ? await Promise.all([
        getPendingApprovalCount(currentUser.id),
        getUnreadNotificationCount(currentUser.id),
      ])
    : [0, 0];

  return (
    <html lang={serverLang} dir={serverLang === "ar" ? "rtl" : "ltr"} className={`${cairo.variable} ${plexArabic.variable}`} suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">{themeInit}</Script>
        <Script id="lang-init" strategy="beforeInteractive">{langInit}</Script>
      </head>
      <body className="bg-background text-foreground antialiased">
        <LangProvider>
          <ElectronTitleBar />
          {currentUser ? (
            <Shell
              currentUser={currentUser}
              pendingApprovalCount={pendingApprovalCount}
              unreadNotificationCount={unreadNotificationCount}
            >
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
