import type { Template } from "@/components/templates/template-types";

export function filterTemplates(templates: Template[], search: string): Template[] {
  const trimmed = search.trim();
  if (!trimmed) return templates;
  const q = trimmed.toLowerCase();
  return templates.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      (t.description ?? "").toLowerCase().includes(q) ||
      (t.docType ?? "").toLowerCase().includes(q) ||
      (t.defaultTags ?? "").toLowerCase().includes(q),
  );
}
