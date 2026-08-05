/** Shared URL/query pagination helpers for backend-driven lists. */
import { z } from "zod";

export type PageResult<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  limit: number;
  offset: number;
};

export type PaginationParams = {
  page: number;
  pageSize: number;
  limit: number;
  offset: number;
};

export function clampPageSize(
  value: number,
  defaults: { defaultSize?: number; maxSize?: number } = {},
) {
  const defaultSize = defaults.defaultSize ?? 25;
  const maxSize = defaults.maxSize ?? 100;
  if (!Number.isFinite(value) || value < 1) return defaultSize;
  return Math.min(Math.floor(value), maxSize);
}

export function parsePagination(
  url: URL,
  defaults: { defaultSize?: number; maxSize?: number } = {},
): PaginationParams {
  const defaultSize = defaults.defaultSize ?? 25;
  const maxSize = defaults.maxSize ?? 100;
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .catch(1)
    .parse(url.searchParams.get("page") ?? 1);
  const pageSize = z.coerce
    .number()
    .int()
    .min(1)
    .max(maxSize)
    .catch(defaultSize)
    .parse(url.searchParams.get("pageSize") ?? defaultSize);
  const offset = (page - 1) * pageSize;
  return { page, pageSize, limit: pageSize, offset };
}

export function toPageResult<T>(
  rows: T[],
  total: number,
  pagination: PaginationParams,
): PageResult<T> {
  return {
    rows,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    limit: pagination.limit,
    offset: pagination.offset,
  };
}

export function totalPages(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function pageRangeLabel(total: number, page: number, pageSize: number) {
  if (total === 0) return "Showing 0 of 0";
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return `Showing ${start}–${end} of ${total}`;
}

/** Build `?…` href for a 1-based page, preserving other query params. */
export function pageSearchHref(
  searchParams: URLSearchParams,
  nextPage: number,
) {
  const params = new URLSearchParams(searchParams);
  if (nextPage <= 1) params.delete("page");
  else params.set("page", String(nextPage));
  const query = params.toString();
  return query ? `?${query}` : "?";
}

/** Build `?…` href for a page size change (resets to page 1). */
export function pageSizeSearchHref(
  searchParams: URLSearchParams,
  nextPageSize: number,
  defaultSize?: number,
) {
  const params = new URLSearchParams(searchParams);
  params.delete("page");
  if (defaultSize != null && nextPageSize === defaultSize) {
    params.delete("pageSize");
  } else {
    params.set("pageSize", String(nextPageSize));
  }
  const query = params.toString();
  return query ? `?${query}` : "?";
}
