/**
 * Pagination service — application-level helper that clamps client-supplied
 * pagination params into a safe page/window for downstream queries.
 *
 * Extracted from the search route so every API route / server action that
 * needs paging goes through one service-owned implementation instead of
 * re-declaring inline clamps.
 */

export const DEFAULT_MAX_PAGE_SIZE = 100;

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 50;

export interface PaginationInput {
  page?: number | string | null;
  pageSize?: number | string | null;
  maxPageSize?: number;
}

export interface Pagination {
  page: number;
  pageSize: number;
  offset: number;
}

export function clampPagination(input: PaginationInput, maxPageSize: number = DEFAULT_MAX_PAGE_SIZE): Pagination {
  const page = Math.max(1, Math.floor(Number(input.page) || DEFAULT_PAGE));
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, Math.floor(Number(input.pageSize) || DEFAULT_PAGE_SIZE))
  );
  return { page, pageSize, offset: (page - 1) * pageSize };
}
