export function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  const title = typeof value === "string" ? value : typeof label === "string" ? label : undefined;
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/20 px-2.5 py-1.5 text-xs transition hover:bg-muted/40">
      <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground [&_svg]:h-3.5 [&_svg]:w-3.5">
        {icon}
        {label}
      </span>
      <span title={title} className="min-w-0 flex-1 break-words text-end font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}
