export function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const words = query
    .replace(/[-ANDOR]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return <>{text}</>;
  const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) =>
        pattern.test(part) ? <mark key={i} className="rounded-[3px] bg-amber-200/70 px-0.5 text-foreground">{part}</mark> : part
      )}
    </>
  );
}
