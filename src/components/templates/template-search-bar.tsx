import { Search, XCircle } from "lucide-react";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

interface TemplateSearchBarProps {
  search: string;
  onChange: (v: string) => void;
  onClear: () => void;
}

export function TemplateSearchBar({ search, onChange, onClear }: TemplateSearchBarProps) {
  useLang(); // re-render on language toggle
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={search}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("بحث في القوالب...")}
        className="min-h-[2.625rem] w-full rounded-xl border border-border bg-card py-2 pe-9 ps-9 text-sm text-foreground shadow-soft outline-none transition placeholder:text-muted-foreground/60 hover:border-primary/30 focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
      />
      {search && (
        <button
          onClick={onClear}
          className="animate-fadein absolute end-3 top-1/2 -translate-y-1/2 rounded-lg p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <XCircle className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
