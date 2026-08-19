import { FileTextIcon, SearchIcon, UsersIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { Badge } from "~/components/reui/badge";
import { ClientSearchResultDetails } from "~/components/search/client-result";
import { HighlightText } from "~/components/search/highlight";
import { SearchResultsStatus } from "~/components/search/search-results-status";
import { useApiSearch } from "~/hooks/search";
import {
  GLOBAL_SEARCH_PARAMS,
  type GlobalSearchApiResponse,
} from "~/lib/search/api-search";
import { clientHasVisibleMatch } from "~/lib/search/client-match";
import { fieldMatches } from "~/lib/search/match";
import type {
  GlobalSearchClientHit,
  GlobalSearchPolicyHit,
} from "~/lib/services/search/global-search.service";
import { cn, formatNumber } from "~/lib/utils";

export type GlobalSearchClient = GlobalSearchClientHit;
export type GlobalSearchPolicy = GlobalSearchPolicyHit;

type ResultRow =
  | { kind: "client"; client: GlobalSearchClient }
  | { kind: "policy"; policy: GlobalSearchPolicy };

function policyHasVisibleMatch(policy: GlobalSearchPolicy, query: string) {
  return (
    fieldMatches(policy.policyNumber, query) ||
    fieldMatches(policy.insuredName, query) ||
    fieldMatches(policy.clientName, query) ||
    fieldMatches(policy.clientTradingName, query) ||
    fieldMatches(policy.statusName, query) ||
    fieldMatches(String(policy.policyId), query)
  );
}

export function GlobalSearch({
  open,
  onOpenChange,
  triggerClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerClassName?: string;
}) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  const {
    trimmedQuery: q,
    active,
    data,
    isSearching,
    isSettled,
    hasError,
    reset: resetSearch,
  } = useApiSearch<GlobalSearchApiResponse>({
    enabled: open,
    query,
    searchParams: GLOBAL_SEARCH_PARAMS,
  });

  const closeSearch = useCallback(() => {
    onOpenChange(false);
    setQuery("");
    setActiveIndex(-1);
    resetSearch();
  }, [onOpenChange, resetSearch]);

  useEffect(() => {
    if (!open) return;

    // Use `click` (not mousedown). Closing on mousedown re-renders before the
    // click fires, so links under the search panel (e.g. Settings → Prices)
    // never receive navigation.
    function onDocumentClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        closeSearch();
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeSearch();
        inputRef.current?.blur();
      }
    }

    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeSearch]);

  const clients = useMemo(() => data?.clients ?? [], [data?.clients]);
  const policies = useMemo(() => data?.policies ?? [], [data?.policies]);
  const clientTotal = data?.clientTotal ?? clients.length;
  const policyTotal = data?.policyTotal ?? policies.length;

  const displayClients = useMemo(
    () =>
      isSettled
        ? clients.filter((client) => clientHasVisibleMatch(client, q))
        : [],
    [isSettled, clients, q],
  );
  const displayPolicies = useMemo(
    () =>
      isSettled
        ? policies.filter((policy) => policyHasVisibleMatch(policy, q))
        : [],
    [isSettled, policies, q],
  );
  const displayClientTotal =
    displayClients.length < clients.length
      ? displayClients.length
      : clientTotal;
  const displayPolicyTotal =
    displayPolicies.length < policies.length
      ? displayPolicies.length
      : policyTotal;
  const hasResults = displayClients.length > 0 || displayPolicies.length > 0;
  const showEmpty = active && isSettled && !hasError && !hasResults;

  const flatResults = useMemo<ResultRow[]>(() => {
    if (!isSettled) return [];
    return [
      ...displayClients.map((client): ResultRow => ({
        kind: "client",
        client,
      })),
      ...displayPolicies.map((policy): ResultRow => ({
        kind: "policy",
        policy,
      })),
    ];
  }, [displayClients, displayPolicies, isSettled]);

  const safeActiveIndex =
    activeIndex >= 0 && activeIndex < flatResults.length ? activeIndex : -1;

  function goTo(row: ResultRow) {
    closeSearch();
    if (row.kind === "client") {
      navigate(`/clients/${row.client.clientId}`);
      return;
    }
    navigate(`/policies/${row.policy.policyId}`);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!active || flatResults.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => {
        const current = index >= 0 && index < flatResults.length ? index : -1;
        return current < flatResults.length - 1 ? current + 1 : 0;
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => {
        const current = index >= 0 && index < flatResults.length ? index : 0;
        return current > 0 ? current - 1 : flatResults.length - 1;
      });
      return;
    }

    if (event.key === "Enter" && safeActiveIndex >= 0) {
      event.preventDefault();
      const row = flatResults[safeActiveIndex];
      if (row) goTo(row);
    }
  }

  const activeOptionId =
    safeActiveIndex >= 0
      ? `global-search-option-${safeActiveIndex}`
      : undefined;

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full max-w-xl", triggerClassName)}
    >
      <div className="relative flex h-9 w-full items-center rounded-lg border border-input bg-muted/40 px-2.5 text-sm transition-colors focus-within:bg-muted/60 focus-within:ring-2 focus-within:ring-ring/40">
        <SearchIcon className="mr-2 size-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(-1);
            onOpenChange(true);
          }}
          onFocus={() => onOpenChange(true)}
          onBlur={() => {
            // Close after blur so the panel can’t keep covering page links.
            // Delay lets result row mousedown (preventDefault) run first.
            window.setTimeout(() => closeSearch(), 150);
          }}
          onKeyDown={onInputKeyDown}
          placeholder="Search clients or policies…"
          className="h-full w-full min-w-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          aria-expanded={open}
          aria-controls="global-search-results"
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          aria-busy={isSearching}
          role="combobox"
        />
      </div>

      {/* Only mount when there is a query — empty focus used to cover Settings. */}
      {active ? (
        <div
          id="global-search-results"
          role="listbox"
          aria-label="Search results"
          className="absolute top-full left-0 z-50 mt-1 max-h-96 w-full overflow-y-auto rounded-lg border bg-popover text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          <SearchResultsStatus
            active={active}
            isSearching={isSearching}
            hasError={hasError}
            showEmpty={showEmpty}
            emptyQuery={q}
            resultCount={hasResults ? flatResults.length : undefined}
            className="py-3"
          />
          {!showEmpty && !hasError && !isSearching && active ? (
            <div className="flex flex-col gap-0.5 p-1">
              {displayClients.length > 0 ? (
                <ResultGroup
                  label="Clients"
                  count={displayClientTotal}
                  showing={displayClients.length}
                >
                  {displayClients.map((client) => {
                    const index = flatResults.findIndex(
                      (row) =>
                        row.kind === "client" &&
                        row.client.clientId === client.clientId,
                    );
                    return (
                      <ClientResult
                        key={`client-${client.clientId}`}
                        id={
                          index >= 0
                            ? `global-search-option-${index}`
                            : undefined
                        }
                        client={client}
                        query={q}
                        active={index === safeActiveIndex}
                        onSelect={() => goTo({ kind: "client", client })}
                      />
                    );
                  })}
                </ResultGroup>
              ) : null}

              {displayPolicies.length > 0 ? (
                <ResultGroup
                  label="Policies"
                  count={displayPolicyTotal}
                  showing={displayPolicies.length}
                >
                  {displayPolicies.map((policy) => {
                    const index = flatResults.findIndex(
                      (row) =>
                        row.kind === "policy" &&
                        row.policy.policyId === policy.policyId,
                    );
                    return (
                      <PolicyResult
                        key={`policy-${policy.policyId}`}
                        id={
                          index >= 0
                            ? `global-search-option-${index}`
                            : undefined
                        }
                        policy={policy}
                        query={q}
                        active={index === safeActiveIndex}
                        onSelect={() => goTo({ kind: "policy", policy })}
                      />
                    );
                  })}
                </ResultGroup>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ClientResult({
  id,
  client,
  query,
  active,
  onSelect,
}: {
  id?: string;
  client: GlobalSearchClient;
  query: string;
  active?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="option"
      aria-selected={active}
      className={cn(
        "flex w-full items-start gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-muted",
        active && "bg-muted",
      )}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
    >
      <UsersIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <ClientSearchResultDetails client={client} query={query} />
    </button>
  );
}

function PolicyResult({
  id,
  policy,
  query,
  active,
  onSelect,
}: {
  id?: string;
  policy: GlobalSearchPolicy;
  query: string;
  active?: boolean;
  onSelect: () => void;
}) {
  const statusMatches = fieldMatches(policy.statusName, query);
  const tradingMatches =
    Boolean(policy.clientTradingName) &&
    fieldMatches(policy.clientTradingName, query) &&
    !fieldMatches(policy.clientName, query);

  return (
    <button
      id={id}
      type="button"
      role="option"
      aria-selected={active}
      className={cn(
        "flex w-full items-start gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-muted",
        active && "bg-muted",
      )}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
    >
      <FileTextIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium">
            <HighlightText text={policy.policyNumber} query={query} />
          </span>
          <Badge
            variant={statusMatches ? "warning-light" : "secondary"}
            size="sm"
            radius="full"
          >
            <HighlightText text={policy.statusName} query={query} />
          </Badge>
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {policy.insuredName ? (
            <HighlightText text={policy.insuredName} query={query} />
          ) : (
            "—"
          )}
          {" · "}
          <HighlightText text={policy.clientName} query={query} />
          {tradingMatches ? (
            <>
              {" · "}
              <HighlightText text={policy.clientTradingName} query={query} />
            </>
          ) : null}
        </span>
        {fieldMatches(String(policy.policyId), query) &&
        !fieldMatches(policy.policyNumber, query) ? (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            Policy ID:{" "}
            <HighlightText text={String(policy.policyId)} query={query} />
          </span>
        ) : null}
      </span>
    </button>
  );
}

function ResultGroup({
  label,
  count,
  showing,
  children,
}: {
  label: string;
  count?: number;
  showing?: number;
  children: React.ReactNode;
}) {
  const countLabel =
    count != null
      ? showing != null && showing < count
        ? `${formatNumber(showing)} of ${formatNumber(count)}`
        : formatNumber(count)
      : null;

  return (
    <div className="flex flex-col gap-0.5">
      <p className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <span>{label}</span>
        {countLabel ? (
          <span className="normal-case tabular-nums">{countLabel}</span>
        ) : null}
      </p>
      {children}
    </div>
  );
}
