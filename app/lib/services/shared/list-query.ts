import { type PaginationParams, clampPageSize } from "~/lib/pagination";

export function likePattern(q: string) {
  return `%${q.replace(/[%_\\]/g, "\\$&")}%`;
}

export function resolvePage(input: {
  limit?: number;
  offset?: number;
  pageSize?: number;
}): PaginationParams {
  const pageSize = clampPageSize(input.limit ?? input.pageSize ?? 25);
  const offset = Math.max(0, input.offset ?? 0);
  const page = Math.floor(offset / pageSize) + 1;
  return { page, pageSize, limit: pageSize, offset };
}
