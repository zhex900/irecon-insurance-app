import { Spinner } from "~/components/ui/spinner";
import { cn } from "~/lib/utils";

type SearchResultsStatusProps = {
  /** When false, show the idle prompt (if provided). */
  active: boolean;
  isSearching: boolean;
  hasError: boolean;
  showEmpty: boolean;
  /** Shown when `showEmpty` is true. */
  emptyQuery?: string;
  /** Announced when results are visible (loading/error/empty are false). */
  resultCount?: number;
  idleMessage?: string;
  loadingMessage?: string;
  errorMessage?: string;
  className?: string;
  /** Optional visible status for screen readers (defaults to derived text). */
  ariaLabel?: string;
};

function statusText({
  active,
  isSearching,
  hasError,
  showEmpty,
  emptyQuery,
  resultCount,
  idleMessage = "Type to search…",
  loadingMessage = "Searching",
  errorMessage = "Search failed",
}: Pick<
  SearchResultsStatusProps,
  | "active"
  | "isSearching"
  | "hasError"
  | "showEmpty"
  | "emptyQuery"
  | "resultCount"
  | "idleMessage"
  | "loadingMessage"
  | "errorMessage"
>) {
  if (!active) return idleMessage;
  if (isSearching) return loadingMessage;
  if (hasError) return errorMessage;
  if (showEmpty)
    return emptyQuery ? `No match for ${emptyQuery}` : "No results";
  if (resultCount != null && resultCount > 0) {
    return `${resultCount} results`;
  }
  return "";
}

export function SearchResultsStatus({
  active,
  isSearching,
  hasError,
  showEmpty,
  emptyQuery,
  resultCount,
  idleMessage,
  loadingMessage = "Searching",
  errorMessage = "Search failed. Try again.",
  className,
  ariaLabel,
}: SearchResultsStatusProps) {
  const liveText =
    ariaLabel ??
    statusText({
      active,
      isSearching,
      hasError,
      showEmpty,
      emptyQuery,
      idleMessage,
      loadingMessage,
      errorMessage,
      resultCount,
    });

  if (active && !isSearching && !hasError && !showEmpty) {
    return liveText ? (
      <p className="sr-only" role="status" aria-live="polite">
        {liveText}
      </p>
    ) : null;
  }

  return (
    <>
      <p className="sr-only" role="status" aria-live="polite">
        {liveText}
      </p>
      <div
        className={cn(
          "flex items-center justify-center gap-2 px-3 py-8 text-center text-sm",
          hasError ? "text-destructive" : "text-muted-foreground",
          className,
        )}
      >
        {!active ? (
          <span>{idleMessage ?? "Type to search…"}</span>
        ) : isSearching ? (
          <>
            <Spinner className="size-4 shrink-0" />
            <span>{loadingMessage}…</span>
          </>
        ) : hasError ? (
          <span>{errorMessage}</span>
        ) : showEmpty ? (
          <span>
            {emptyQuery ? (
              <>No match for &ldquo;{emptyQuery}&rdquo;.</>
            ) : (
              "No results."
            )}
          </span>
        ) : null}
      </div>
    </>
  );
}
