/**
 * Shared Mermaid diagram generators for EDMS analytics.
 *
 * IMPORTANT: this module is intentionally NOT a "use client" module. It is a
 * pure-data module (no React, no DOM, no hooks) so it can be imported and its
 * functions CALLED from both React Server Components (analytics page) and
 * client components (mermaid renderer). Exporting these helpers from a
 * "use client" file would turn them into client references that cannot be
 * invoked in the RSC context.
 */

/**
 * Build a gantt-based horizontal bar chart for labelled counts.
 * Labels are quoted and unique task ids are used so Arabic names with
 * spaces, parentheses, commas or quotes do not break the gantt parser.
 */
export function buildCountBar(title: string, stats: Record<string, number>): string {
  const entries = Object.entries(stats).filter(([, count]) => count > 0);
  const lines: string[] = [
    "gantt",
    `  title ${title}`,
    "  dateFormat  YYYY-MM-DD",
    "  section المستندات",
  ];
  entries.forEach(([label, count], i) => {
    const safe = label.replace(/"/g, '\\"').replace(/[\r\n]/g, " ").trim();
    lines.push(`  "${safe}" :t${i}, 2024-01-01, ${count}d`);
  });
  return lines.join("\n");
}

/**
 * Pre-built diagram generators for common EDMS use cases.
 */
export const EDMS_DIAGRAMS = {
  /** Folder structure as a tree diagram */
  folderTree: (folders: Array<{ name: string; children?: string[] }>) => {
    const lines: string[] = ["flowchart TD"];
    let nodeId = 0;
    const usedNames = new Set<string>();

    function addNode(name: string, parentId: string | null, prefix: string) {
      const nodeName = name.replace(/[^a-zA-Z0-9أ-ي]/g, "_");
      const nodeIdStr = `node_${nodeId++}`;
      if (!usedNames.has(nodeName)) {
        usedNames.add(nodeName);
        lines.push(`  ${nodeIdStr}["${name}"]`);
      }
      if (parentId) {
        lines.push(`  ${parentId} --> ${nodeIdStr}`);
      }
      return nodeIdStr;
    }

    const rootId = addNode("الأرشيف الرئيسي", null, "");
    for (const folder of folders) {
      const folderId = addNode(folder.name, rootId, "");
      if (folder.children) {
        for (const child of folder.children) {
          addNode(child, folderId, "");
        }
      }
    }

    return lines.join("\n");
  },

  /** Document status distribution as a pie chart */
  statusPie: (stats: Record<string, number>) => {
    const entries = Object.entries(stats).filter(([, count]) => count > 0);
    const lines: string[] = ["pie"];
    for (const [status, count] of entries) {
      lines.push(`  "${status}" : ${count}`);
    }
    return lines.join("\n");
  },

  /** Document type distribution as a bar chart (using gantt as bar) */
  docTypeBar: (stats: Record<string, number>) =>
    buildCountBar("توزيع أنواع المستندات", stats),

  /** Department distribution as a bar chart */
  deptBar: (stats: Record<string, number>) =>
    buildCountBar("توزيع المستندات حسب القسم", stats),

  /** Document workflow as a sequence diagram */
  workflowSequence: () => {
    return `sequenceDiagram
    participant U as المستخدم
    participant S as النظام
    participant A as الأرشيف
    U->>S: رفع مستند
    S->>S: مسح الباركود
    S->>A: حفظ المستند
    A-->>S: تأكيد الحفظ
    S-->>U: إشعار بنجاح الحفظ`;
  },
};
