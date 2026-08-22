"use client";

import { Toaster as Sonner } from "sonner";
import { useIsDark } from "@/components/theme-provider";

export function Toaster() {
  const dark = useIsDark();
  return (
    <Sonner
      theme={dark ? "dark" : "light"}
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        style: { fontFamily: "var(--font-cairo), system-ui, sans-serif" },
      }}
    />
  );
}
