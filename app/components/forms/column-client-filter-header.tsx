import { useEffect, useMemo, useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  ListFilterIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Spinner } from "~/components/ui/spinner";
import { ClientSearchResultDetails } from "~/components/search/client-result";
import { useApiSearch } from "~/hooks/use-api-search";
import {
  CLIENT_FILTER_SEARCH_PARAMS,
  type ClientsSearchApiResponse,
} from "~/lib/search/api-search";
import {
  clientHasVisibleMatch,
  type ClientSearchResult,
} from "~/lib/search/client-match";
import { cn } from "~/lib/utils";

export type ColumnClientFilterOption = {
  clientId: number;
  name: string;
  tradingName?: string;
};

export function ColumnClientFilterHeader({
  selected,
  selectedOptions,
  onChange,
  /** Current list filters (minus client) as query string, for policy counts. */
  countQuery,
  align = "start",
}: {
  selected: number[];
  /** Resolved labels for currently selected clients (from loader). */
  selectedOptions: ColumnClientFilterOption[];
  onChange: (next: number[]) => void;
  countQuery?: string;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [localOptions, setLocalOptions] = useState<ColumnClientFilterOption[]>(
    [],
  );
  const [policyCounts, setPolicyCounts] = useState<Record<number, number>>({});
  /** Local draft so multi-select (OR) stays responsive while the URL revalidates. */
  const [draft, setDraft] = useState(selected);
  const active = selected.length > 0;

  const {
    trimmedQuery: q,
    data,
    isSearching,
    isSettled,
    reset: resetSearch,
  } = useApiSearch<ClientsSearchApiResponse>({
    enabled: open,
    query,
    debounceMs: 200,
    searchParams: CLIENT_FILTER_SEARCH_PARAMS,
  });

  function handleOpenChange(next: boolean) {
    if (next) {
      setDraft(selected);
    } else {
      setQuery("");
      resetSearch();
      setPolicyCounts({});
    }
    setOpen(next);
  }

  const selectedSet = new Set(draft);

  const displayHits = useMemo(() => {
    if (!q || !isSettled) return [];
    const hits = data?.clients ?? [];
    return hits.filter((client) => clientHasVisibleMatch(client, q));
  }, [data?.clients, isSettled, q]);

  const countIdsKey = useMemo(() => {
    const ids = new Set<number>([
      ...draft,
      ...displayHits.map((hit) => hit.clientId),
    ]);
    return [...ids].sort((a, b) => a - b).join(",");
  }, [draft, displayHits]);

  useEffect(() => {
    if (!open || !countIdsKey) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams(countQuery ?? "");
        params.set("type", "client-policy-counts");
        params.set("ids", countIdsKey);
        params.delete("client");
        params.delete("page");
        const response = await fetch(`/api/search?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Count failed");
        const data = (await response.json()) as {
          counts: Record<string, number>;
        };
        const next: Record<number, number> = {};
        for (const [id, count] of Object.entries(data.counts ?? {})) {
          next[Number(id)] = Number(count);
        }
        setPolicyCounts(next);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setPolicyCounts({});
      }
    }, 150);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, countIdsKey, countQuery]);

  const shownCounts =
    open && countIdsKey.length > 0
      ? policyCounts
      : ({} as Record<number, number>);

  const selectedById = useMemo(() => {
    const map = new Map<number, ColumnClientFilterOption>();
    for (const option of localOptions) map.set(option.clientId, option);
    for (const option of selectedOptions) map.set(option.clientId, option);
    return map;
  }, [localOptions, selectedOptions]);

  function toggle(client: ClientSearchResult) {
    setLocalOptions((prev) => {
      if (prev.some((item) => item.clientId === client.clientId)) return prev;
      return [
        ...prev,
        {
          clientId: client.clientId,
          name: client.name,
          tradingName: client.tradingName,
        },
      ];
    });
    const next = selectedSet.has(client.clientId)
      ? draft.filter((id) => id !== client.clientId)
      : [...draft, client.clientId];
    setDraft(next);
    onChange(next);
  }

  function remove(clientId: number) {
    const next = draft.filter((id) => id !== clientId);
    setDraft(next);
    onChange(next);
  }

  function clear() {
    setDraft([]);
    onChange([]);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "-ml-1.5 inline-flex flex-nowrap items-center gap-1 rounded-md px-1.5 py-0.5 text-left text-sm font-medium whitespace-nowrap transition-colors hover:bg-muted",
              active && "bg-muted text-foreground",
            )}
          />
        }
      >
        <span className="shrink-0">Client</span>
        {active ? (
          <span className="shrink-0 rounded-full bg-primary px-1.5 text-[10px] leading-4 font-semibold text-primary-foreground tabular-nums">
            {selected.length}
          </span>
        ) : (
          <ListFilterIcon className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <ChevronDownIcon
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-96 gap-1.5 p-2"
        onClick={(event) => event.stopPropagation()}
      >
        <PopoverHeader className="flex-row items-center justify-between px-1">
          <PopoverTitle className="text-xs tracking-wide text-muted-foreground uppercase">
            Client
          </PopoverTitle>
          {draft.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="h-6 px-1.5 text-xs"
              onClick={clear}
            >
              Clear
            </Button>
          ) : null}
        </PopoverHeader>

        {draft.length > 0 ? (
          <div className="flex max-h-28 flex-col gap-0.5 overflow-auto border-b pb-1.5">
            {draft.map((clientId) => {
              const option = selectedById.get(clientId);
              const label = option?.name ?? `Client #${clientId}`;
              const trading = option?.tradingName?.trim();
              return (
                <div
                  key={clientId}
                  className="flex items-center gap-1 rounded-md bg-muted/60 px-2 py-1 text-sm"
                >
                  <CheckIcon className="size-3.5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate">
                    {label}
                    {trading ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {trading}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {shownCounts[clientId] ?? 0}
                  </span>
                  <button
                    type="button"
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${label}`}
                    onClick={() => remove(clientId)}
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, ABN, phone, email…"
            className="h-8 pl-7"
            autoFocus
          />
        </div>

        <div className="flex max-h-64 flex-col gap-0.5 overflow-auto">
          {!q ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              Type to find clients
            </p>
          ) : isSearching ? (
            <p className="flex items-center justify-center gap-2 px-2 py-3 text-xs text-muted-foreground">
              <Spinner className="size-3.5" />
              Searching…
            </p>
          ) : displayHits.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              No match for “{q}”.
            </p>
          ) : (
            displayHits.map((hit) => {
              const checked = selectedSet.has(hit.clientId);
              return (
                <button
                  key={hit.clientId}
                  type="button"
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                    checked && "bg-muted/70",
                  )}
                  onClick={() => toggle(hit)}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background",
                    )}
                    aria-hidden
                  >
                    {checked ? <CheckIcon className="size-3" /> : null}
                  </span>
                  <ClientSearchResultDetails client={hit} query={q} />
                  <span className="mt-0.5 shrink-0 text-xs text-muted-foreground tabular-nums">
                    {shownCounts[hit.clientId] ?? 0}
                  </span>
                </button>
              );
            })
          )}
        </div>
        <p className="px-1 pt-0.5 text-[11px] text-muted-foreground">
          OR — select multiple values
        </p>
      </PopoverContent>
    </Popover>
  );
}
