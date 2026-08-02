import { useEffect, useMemo, useState } from "react";
import { useNavigate, useNavigation } from "react-router";
import { SearchIcon } from "lucide-react";
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
import {
  clientHasVisibleMatch,
  type ClientSearchResult,
} from "~/lib/search/client-match";
import { ClientSearchResultDetails } from "~/lib/search/client-result";
import { cn } from "~/lib/utils";

type ClientHit = ClientSearchResult;

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
                <ClientSearchResultDetails client={client} query={q} />
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
