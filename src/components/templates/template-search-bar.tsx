import { Search, XCircle } from "lucide-react";

interface TemplateSearchBarProps {
  search: string;
  onChange: (v: string) => void;
  onClear: () => void;
}

export function TemplateSearchBar({ search, onChange, onClear }: TemplateSearchBarProps) {
  return (
    <div className="relative mb-4">
      <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={search}
        onChange={(e) => onChange(e.target.value)}
        placeholder="بحث في القوالب..."
        className="w-full rounded-xl border border-border bg-muted/50 py-2 ps-9 pe-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      {search && (
        <button
          onClick={onClear}
          className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <XCircle className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
