// Mermaid diagram renderer for Next.js / React.
// Uses mermaid.js (MIT, free) to render text-based diagrams as SVG.
// Supports: flowchart, sequence, gantt, class, state, er, journey, pie, etc.

"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";
// EDMS_DIAGRAMS lives in a shared (non-"use client") module so server
// components can call its helper functions; see src/lib/edms-diagrams.ts.
export { EDMS_DIAGRAMS, buildCountBar } from "@/lib/edms-diagrams";

export type MermaidDiagramType =
  | "flowchart"
  | "sequence"
  | "gantt"
  | "class"
  | "state"
  | "er"
  | "journey"
  | "pie"
  | "gitGraph"
  | "requirement"
  | "kanban"
  | "mindmap";

interface MermaidRendererProps {
  /** Mermaid diagram definition text (e.g. "flowchart TD\nA-->B") */
  definition: string;
  /** Optional type for auto-wrapping */
  type?: MermaidDiagramType;
  /** Optional CSS class for the container */
  className?: string;
  /** Optional id for the SVG element */
  id?: string;
}

let mermaidInitialized = false;

/**
 * Render a Mermaid diagram from text definition.
 *
 * Usage:
 *   <MermaidRenderer
 *     definition="flowchart TD
 *       A[بداية] --> B{نوع المستند؟}
 *       B -->|عقد| C[عقود]
 *       B -->|فاتورة| D[فواتور]
 *       C --> E[نهاية]
 *       D --> E"
 *   />
 */
export function MermaidRenderer({
  definition,
  type,
  className,
  id,
}: MermaidRendererProps) {
  useLang(); // re-render on language toggle
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Build the full definition with type prefix if provided. Some callers
  // (edms-diagrams helpers) already include the type line in the definition —
  // never duplicate it, or Mermaid fails to parse ("flowchartflowchart TD").
  const fullDefinition =
    type && !definition.trimStart().startsWith(type) ? `${type}\n${definition}` : definition;

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function render() {
      try {
        if (typeof window === "undefined") return;

        // Dynamic import to avoid SSR issues
        const { default: mermaid } = await import("mermaid");

        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: "default",
            securityLevel: "strict",
            fontFamily: "Cairo, sans-serif",
          });
          mermaidInitialized = true;
        }

        // Generate a unique ID for this diagram (crypto.randomUUID avoids
        // Math.random collisions; runs only inside this client-side effect)
        const diagramId = id || `mermaid-diagram-${crypto.randomUUID().replace(/-/g, "")}`;

        // Clear previous content (replaceChildren avoids the innerHTML sink)
        if (containerRef.current) {
          containerRef.current.replaceChildren();
        }

        // Render the diagram
        const { svg } = await mermaid.render(
          diagramId,
          fullDefinition,
          containerRef.current ?? undefined,
        );

        if (!cancelled && containerRef.current) {
          // Defense in depth: mermaid's securityLevel="strict" already strips
          // scripts/event handlers, and DOMPurify re-sanitizes the SVG before
          // it is injected into the DOM (also covers future config changes).
          const { default: DOMPurify } = await import("dompurify");
          containerRef.current.innerHTML = DOMPurify.sanitize(svg, {
            USE_PROFILES: { svg: true, svgFilters: true },
          });
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? t(e.message) : t("فشل عرض المخطط"));
          setLoading(false);
        }
      }
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [fullDefinition, id]);

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      {loading && (
        <div
          style={{
            fontSize: "12px",
            color: "#94a3b8",
            textAlign: "center",
            padding: "8px",
          }}
        >{t("جارٍ عرض المخطط...")}</div>
      )}
      {error && (
        <div
          style={{
            fontSize: "12px",
            color: "#ef4444",
            textAlign: "center",
            padding: "8px",
          }}
        >
          {error}
        </div>
      )}
      {/* Empty host node. Mermaid writes the SVG here directly; React never
          renders children into it, so hydration/DOM reconciliation cannot
          conflict with the imperative DOM writes (replaceChildren + innerHTML). */}
      <div
        ref={containerRef}
        style={{
          minHeight: loading ? "100px" : "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: loading ? 0.5 : 1,
        }}
      />
    </div>
  );
}
