import { useNavigate } from "react-router";
import { AppSelect } from "~/components/ui/app-select";
import { useHydrated } from "~/hooks/network";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "~/components/ui/pagination";
import { totalPages } from "~/lib/pagination";

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 25, 50, 100] as const;

function getPaginationItems(
  current: number,
  pages: number,
  siblingCount = 1,
): Array<number | "ellipsis"> {
  const totalPageNumbers = siblingCount * 2 + 5;
  if (pages <= totalPageNumbers) {
    return Array.from({ length: pages }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(current - siblingCount, 1);
  const rightSibling = Math.min(current + siblingCount, pages);
  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < pages - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftItemCount = 3 + 2 * siblingCount;
    return [
      ...Array.from({ length: leftItemCount }, (_, i) => i + 1),
      "ellipsis",
      pages,
    ];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const rightItemCount = 3 + 2 * siblingCount;
    return [
      1,
      "ellipsis",
      ...Array.from(
        { length: rightItemCount },
        (_, i) => pages - rightItemCount + i + 1,
      ),
    ];
  }

  return [
    1,
    "ellipsis",
    ...Array.from(
      { length: rightSibling - leftSibling + 1 },
      (_, i) => leftSibling + i,
    ),
    "ellipsis",
    pages,
  ];
}

export function TablePagination({
  total,
  page,
  pageSize,
  pageHref,
  pageSizeHref,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: {
  total: number;
  page: number;
  pageSize: number;
  /** Build href for a 1-based page number (keep other query params). */
  pageHref: (nextPage: number) => string;
  /** Build href when page size changes (should reset to page 1). */
  pageSizeHref?: (nextPageSize: number) => string;
  pageSizeOptions?: readonly number[];
}) {
  const navigate = useNavigate();
  const hydrated = useHydrated();
  const pages = totalPages(total, pageSize);
  const current = Math.min(Math.max(page, 1), pages);
  const items = getPaginationItems(current, pages);
  const sizeOptions = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b);

  return (
    <Pagination className="border-t px-4 py-3">
      <PaginationContent className="w-full justify-between gap-3">
        <PaginationItem>
          <span className="text-sm text-muted-foreground">
            Page <span className="font-medium text-foreground">{current}</span>{" "}
            of <span className="font-medium text-foreground">{pages}</span>
          </span>
        </PaginationItem>

        <PaginationItem className="flex items-center gap-1">
          <PaginationPrevious
            to={pageHref(current - 1)}
            disabled={current <= 1}
          />
          {items.map((item, index) =>
            item === "ellipsis" ? (
              <PaginationEllipsis key={`ellipsis-${index}`} />
            ) : (
              <PaginationLink
                key={item}
                to={pageHref(item)}
                isActive={item === current}
              >
                {item}
              </PaginationLink>
            ),
          )}
          <PaginationNext
            to={pageHref(current + 1)}
            disabled={current >= pages}
          />
        </PaginationItem>

        <PaginationItem>
          {pageSizeHref ? (
            hydrated ? (
              <AppSelect
                className="w-28"
                aria-label="Rows per page"
                value={String(pageSize)}
                onValueChange={(next) => {
                  navigate(pageSizeHref(Number(next)));
                }}
                options={sizeOptions.map((size) => ({
                  value: String(size),
                  label: `${size} / page`,
                }))}
              />
            ) : (
              <span className="inline-flex h-8 w-28 items-center justify-end text-sm text-muted-foreground tabular-nums">
                {pageSize} / page
              </span>
            )
          ) : (
            <span className="text-sm text-muted-foreground tabular-nums">
              {pageSize} / page
            </span>
          )}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
