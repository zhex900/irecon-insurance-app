import { useEffect, useMemo, useState } from "react";
import { useNavigate, useNavigation } from "react-router";
import { PhoneIcon, SearchIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { HighlightText } from "~/lib/search/highlight";
import { fieldMatches } from "~/lib/search/match";
import type { GlobalSearchClientHit } from "~/lib/services/search/global-search.service";
import { cn } from "~/lib/utils";

type ClientHit = GlobalSearchClientHit;

function clientHasVisibleMatch(client: ClientHit, query: string) {
  return (
    fieldMatches(client.name, query) ||
    fieldMatches(client.tradingName, query) ||
    fieldMatches(client.abn, query) ||
    fieldMatches(client.phone, query) ||
    fieldMatches(client.email, query) ||
    fieldMatches(client.accountManagerName, query) ||
    fieldMatches(client.arCompanyName, query) ||
    fieldMatches(client.arName, query)
  );
}

export function NewPolicyClientDialog({
  triggerLabel = "+ New Policy",
  triggerVariant = "default",
}: {
  triggerLabel?: string;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [clients, setClients] = useState<ClientHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [settledQuery, setSettledQuery] = useState<string | null>(null);
  const [creatingClientId, setCreatingClientId] = useState<number | null>(null);
  const creating =
    creatingClientId != null &&
    navigation.state !== "idle" &&
    navigation.location?.pathname === "/policies/new";

  const q = search.trim();
  const active = open && q.length > 0;

  useEffect(() => {
    if (!active) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          type: "clients",
          limit: "25",
          q,
        });
        const response = await fetch(`/api/search?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Search failed");
        const data = (await response.json()) as { clients: ClientHit[] };
        setClients(data.clients ?? []);
        setSettledQuery(q);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setClients([]);
        setSettledQuery(q);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [active, q]);

  const displayClients = useMemo(() => {
    if (!active || settledQuery !== q) return [];
    return clients.filter((client) => clientHasVisibleMatch(client, q));
  }, [active, clients, q, settledQuery]);

  const searching = active && (loading || settledQuery !== q);
  const showEmpty =
    active && !searching && settledQuery === q && displayClients.length === 0;

  function selectClient(clientId: number) {
    setCreatingClientId(clientId);
    navigate(`/policies/new?clientId=${clientId}`);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSearch("");
          setClients([]);
          setSettledQuery(null);
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
          />
        </div>

        <div className="flex h-80 flex-col gap-0.5 overflow-auto rounded-lg border p-1">
          {!active ? (
            <p className="px-2.5 py-8 text-center text-sm text-muted-foreground">
              Type to search clients…
            </p>
          ) : searching || (loading && displayClients.length === 0) ? (
            <p className="px-2.5 py-8 text-center text-sm text-muted-foreground">
              Searching…
            </p>
          ) : showEmpty ? (
            <p className="px-2.5 py-8 text-center text-sm text-muted-foreground">
              No match for “{q}”.
            </p>
          ) : (
            displayClients.map((client) => (
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
                <ClientResultDetails client={client} query={q} />
              </button>
            ))
          )}
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

function ClientResultDetails({
  client,
  query,
}: {
  client: ClientHit;
  query: string;
}) {
  const showTrading = Boolean(client.tradingName);
  const showAbn = Boolean(client.abn);
  const showPhone = Boolean(client.phone);

  const matchedFields = (
    [
      { label: "Email", value: client.email },
      { label: "Account Manager", value: client.accountManagerName },
      { label: "AR Company Name", value: client.arCompanyName },
      { label: "AR Name", value: client.arName },
    ] as const
  ).filter((field) => fieldMatches(field.value, query));

  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate font-medium">
        <HighlightText text={client.name} query={query} />
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
        {showTrading ? (
          <span className="truncate">
            <HighlightText text={client.tradingName} query={query} />
          </span>
        ) : null}
        {showTrading && (showAbn || showPhone) ? (
          <span aria-hidden>·</span>
        ) : null}
        {showAbn ? (
          <span className="shrink-0">
            ABN <HighlightText text={client.abn} query={query} />
          </span>
        ) : null}
        {showAbn && showPhone ? <span aria-hidden>·</span> : null}
        {showPhone ? (
          <span className="inline-flex shrink-0 items-center gap-1">
            <PhoneIcon className="size-3" aria-hidden />
            <HighlightText text={client.phone} query={query} />
          </span>
        ) : null}
        {!showTrading && !showAbn && !showPhone && matchedFields.length === 0
          ? "—"
          : null}
      </span>
      {matchedFields.length > 0 ? (
        <span className="mt-1 flex min-w-0 flex-col gap-0.5 text-xs">
          {matchedFields.map((field) => (
            <span key={field.label} className="truncate text-muted-foreground">
              <span className="font-medium text-foreground/70">
                {field.label}:{" "}
              </span>
              <HighlightText text={field.value} query={query} />
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}
