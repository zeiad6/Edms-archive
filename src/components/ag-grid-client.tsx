"use client";

import { AgGridReact } from "ag-grid-react";
import type { AgGridReactProps } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  colorSchemeDark,
  themeQuartz,
} from "ag-grid-community";

// AG Grid v36 requires explicit module registration before the grid mounts.
// AllCommunityModule pulls in every free community feature (sorting, filters,
// pagination, CSV export, row model...) — this module is lazy-loaded together
// with the grid itself so it never bloats the main bundle.
ModuleRegistry.registerModules([AllCommunityModule]);

interface AgGridClientProps extends AgGridReactProps {
  /** When true, applies the dark color scheme part to the Quartz theme. */
  dark?: boolean;
}

/**
 * AG Grid v36 wrapper: JS theme API (themeQuartz) with automatic light/dark
 * switching via the `dark` class on <html>. Passed the `theme` prop instead of
 * the legacy `ag-theme-quartz` CSS classes (which trigger errors #106/#239).
 */
export default function AgGridClient({ dark, ...props }: AgGridClientProps) {
  const theme = dark ? themeQuartz.withPart(colorSchemeDark) : themeQuartz;
  return <AgGridReact theme={theme} {...props} />;
}
