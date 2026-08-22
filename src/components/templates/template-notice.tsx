import { Check, X } from "lucide-react";

export interface TemplateNoticeProps {
  msg: { type: "ok" | "err"; text: string } | null;
}

export function TemplateNotice({ msg }: TemplateNoticeProps) {
  if (!msg) return null;
  return (
    <div
      className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
        msg.type === "ok"
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
          : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
      }`}
    >
      {msg.type === "ok" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
      {msg.text}
    </div>
  );
}
