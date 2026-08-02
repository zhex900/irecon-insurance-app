import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { FileTextIcon, SearchIcon, UsersIcon } from "lucide-react";
import { Badge } from "~/components/reui/badge";
import {
  clientHasVisibleMatch,
  type ClientSearchResult,
} from "~/lib/search/client-match";
import { ClientSearchResultDetails } from "~/lib/search/client-result";
import { HighlightText } from "~/lib/search/highlight";
import { fieldMatches } from "~/lib/search/match";
import { cn, formatNumber } from "~/lib/utils";

export type GlobalSearchClient = ClientSearchResult;

export type GlobalSearchPolicy = {
  policyId: number;
  policyNumber: string;
  insuredName: string;
  clientName: string;
  clientTradingName: string;
  clientId: number;
  statusName: string;
};

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
  const [clients, setClients] = useState<GlobalSearchClient[]>([]);
  const [policies, setPolicies] = useState<GlobalSearchPolicy[]>([]);
  const [clientTotal, setClientTotal] = useState(0);
  const [policyTotal, setPolicyTotal] = useState(0);
  /** Query string the current clients/policies results belong to. */
  const [settledQuery, setSettledQuery] = useState<string | null>(null);

  const closeSearch = useCallback(() => {
    onOpenChange(false);
    setQuery("");
    setClients([]);
    setPolicies([]);
    setClientTotal(0);
    setPolicyTotal(0);
    setSettledQuery(null);
  }, [onOpenChange]);

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

  const q = query.trim();
  const active = open && q.length > 0;

  useEffect(() => {
    if (!active) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Search failed");
        const data = (await response.json()) as {
          clients: GlobalSearchClient[];
          policies: GlobalSearchPolicy[];
          clientTotal?: number;
          policyTotal?: number;
          total?: number;
        };
        setClients(data.clients ?? []);
        setPolicies(data.policies ?? []);
        setClientTotal(data.clientTotal ?? data.clients?.length ?? 0);
        setPolicyTotal(data.policyTotal ?? data.policies?.length ?? 0);
        setSettledQuery(q);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setClients([]);
        setPolicies([]);
        setClientTotal(0);
        setPolicyTotal(0);
        setSettledQuery(q);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [active, q]);

  function goTo(row: ResultRow) {
    closeSearch();
    if (row.kind === "client") {
      navigate(`/clients/${row.client.clientId}`);
      return;
    }
    navigate(`/policies/${row.policy.policyId}`);
  }

  const settled = settledQuery === q;
  const displayClients = settled
    ? clients.filter((client) => clientHasVisibleMatch(client, q))
    : [];
  const displayPolicies = settled
    ? policies.filter((policy) => policyHasVisibleMatch(policy, q))
    : [];
  // Server totals may include rows matched on hidden fields — align badge to UI.
  const displayClientTotal =
    displayClients.length < clients.length
      ? displayClients.length
      : clientTotal;
  const displayPolicyTotal =
    displayPolicies.length < policies.length
      ? displayPolicies.length
      : policyTotal;
  const hasResults = displayClients.length > 0 || displayPolicies.length > 0;
  const searching = active && !settled;
  const showEmpty = active && settled && !hasResults;

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
            onOpenChange(true);
          }}
          onFocus={() => onOpenChange(true)}
          onBlur={() => {
            // Close after blur so the panel can’t keep covering page links.
            // Delay lets result row mousedown (preventDefault) run first.
            window.setTimeout(() => closeSearch(), 150);
          }}
          placeholder="Search clients or policies…"
          className="h-full w-full min-w-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          aria-expanded={open}
          aria-controls="global-search-results"
          aria-autocomplete="list"
          role="combobox"
        />
      </div>

      {/* Only mount when there is a query — empty focus used to cover Settings. */}
      {active ? (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute top-full left-0 z-50 mt-1 max-h-96 w-full overflow-y-auto rounded-lg border bg-popover text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          {showEmpty ? (
            <p className="px-3 py-6 text-center text-muted-foreground">
              No match for “{q}”.
            </p>
          ) : searching ? (
            <p className="px-3 py-3 text-muted-foreground">Searching…</p>
          ) : (
            <div className="flex flex-col gap-0.5 p-1">
              {displayClients.length > 0 ? (
                <ResultGroup
                  label="Clients"
                  count={displayClientTotal}
                  showing={displayClients.length}
                >
                  {displayClients.map((client) => (
                    <ClientResult
                      key={`client-${client.clientId}`}
                      client={client}
                      query={q}
                      onSelect={() => goTo({ kind: "client", client })}
                    />
                  ))}
                </ResultGroup>
              ) : null}

              {displayPolicies.length > 0 ? (
                <ResultGroup
                  label="Policies"
                  count={displayPolicyTotal}
                  showing={displayPolicies.length}
                >
                  {displayPolicies.map((policy) => (
                    <PolicyResult
                      key={`policy-${policy.policyId}`}
                      policy={policy}
                      query={q}
                      onSelect={() => goTo({ kind: "policy", policy })}
                    />
                  ))}
                </ResultGroup>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ClientResult({
  client,
  query,
  onSelect,
}: {
  client: GlobalSearchClient;
  query: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      className="flex w-full items-start gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-muted"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
    >
      <UsersIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <ClientSearchResultDetails client={client} query={query} />
    </button>
  );
}

function PolicyResult({
  policy,
  query,
  onSelect,
}: {
  policy: GlobalSearchPolicy;
  query: string;
  onSelect: () => void;
}) {
  const statusMatches = fieldMatches(policy.statusName, query);
  const tradingMatches =
    Boolean(policy.clientTradingName) &&
    fieldMatches(policy.clientTradingName, query) &&
    !fieldMatches(policy.clientName, query);

  return (
    <button
      type="button"
      role="option"
      className="flex w-full items-start gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-muted"
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
