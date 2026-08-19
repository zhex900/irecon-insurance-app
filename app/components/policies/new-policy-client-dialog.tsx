import { SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigation, useSubmit } from "react-router";

import { ClientSearchResultDetails } from "~/components/search/client-result";
import { SearchResultsStatus } from "~/components/search/search-results-status";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";
import { useApiSearch } from "~/hooks/search";
import {
  CLIENT_PICKER_SEARCH_PARAMS,
  type ClientsSearchApiResponse,
} from "~/lib/search/api-search";
import {
  clientHasVisibleMatch,
  type ClientSearchResult,
} from "~/lib/search/client-match";
import { cn } from "~/lib/utils";

type ClientHit = ClientSearchResult;

export function NewPolicyClientDialog({
  triggerLabel = "+ New Policy",
  triggerVariant = "default",
}: {
  triggerLabel?: string;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const submit = useSubmit();
  const navigation = useNavigation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creatingClientId, setCreatingClientId] = useState<string | null>(null);
  const creating =
    creatingClientId != null &&
    navigation.state !== "idle" &&
    navigation.formAction?.startsWith("/policies/new");

  const {
    trimmedQuery: q,
    active,
    data,
    isSearching,
    isSettled,
    hasError,
    reset: resetSearch,
  } = useApiSearch<ClientsSearchApiResponse>({
    enabled: open,
    query: search,
    debounceMs: 200,
    searchParams: CLIENT_PICKER_SEARCH_PARAMS,
  });

  const displayClients = useMemo(() => {
    if (!isSettled) return [];
    const clients = data?.clients ?? [];
    return clients.filter((client) => clientHasVisibleMatch(client, q));
  }, [data?.clients, isSettled, q]);

  const showEmpty =
    active && isSettled && !hasError && displayClients.length === 0;

  function selectClient(clientId: string) {
    setCreatingClientId(clientId);
    submit(null, {
      method: "post",
      action: `/policies/new?clientId=${clientId}`,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSearch("");
          resetSearch();
          setCreatingClientId(null);
        }
      }}
    >
      <DialogTrigger render={<Button variant={triggerVariant} />}>
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Select a client</DialogTitle>
          <DialogDescription>
            Choose a client to create a new CAR policy.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, ABN, phone, email…"
            className="pl-8"
            autoFocus
            aria-busy={isSearching}
          />
        </div>

        <div className="flex h-80 flex-col gap-0.5 overflow-auto rounded-lg border p-1">
          <SearchResultsStatus
            active={active}
            isSearching={isSearching}
            hasError={hasError}
            showEmpty={showEmpty}
            emptyQuery={q}
            resultCount={
              displayClients.length > 0 ? displayClients.length : undefined
            }
            idleMessage="Type to search clients…"
          />
          {active && !isSearching && !hasError && !showEmpty
            ? displayClients.map((client: ClientHit) => (
                <button
                  key={client.clientId}
                  type="button"
                  disabled={creating}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-muted",
                    creating && "opacity-60",
                  )}
                  onClick={() => {
                    if (creating) return;
                    selectClient(client.clientId);
                  }}
                >
                  {creatingClientId === client.clientId ? (
                    <Spinner className="mt-0.5 size-3.5 shrink-0" />
                  ) : null}
                  <ClientSearchResultDetails client={client} query={q} />
                </button>
              ))
            : null}
        </div>

        <p className="text-xs text-muted-foreground">
          {active
            ? "Matching clients only · up to 25"
            : "Start typing to find a client"}
        </p>
      </DialogContent>
    </Dialog>
  );
}
