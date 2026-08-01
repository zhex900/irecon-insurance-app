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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { HighlightText } from "~/lib/search/highlight";
import { fieldMatches } from "~/lib/search/match";
import { cn } from "~/lib/utils";

type ClientHit = {
  clientId: number;
  name: string;
  tradingName: string;
};

function clientHasVisibleMatch(client: ClientHit, query: string) {
  return (
    fieldMatches(client.name, query) || fieldMatches(client.tradingName, query)
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
            placeholder="Search by name or trading name…"
            className="pl-8"
            autoFocus
          />
        </div>

        <div className="max-h-80 overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!active ? (
                <TableRow>
                  <TableCell className="py-8 text-center text-muted-foreground">
                    Type to search clients…
                  </TableCell>
                </TableRow>
              ) : searching || (loading && displayClients.length === 0) ? (
                <TableRow>
                  <TableCell className="py-8 text-center text-muted-foreground">
                    Searching…
                  </TableCell>
                </TableRow>
              ) : showEmpty ? (
                <TableRow>
                  <TableCell className="py-8 text-center text-muted-foreground">
                    No match for “{q}”.
                  </TableCell>
                </TableRow>
              ) : (
                displayClients.map((client) => {
                  const nameMatches = fieldMatches(client.name, q);
                  const tradingMatches = fieldMatches(client.tradingName, q);
                  return (
                    <TableRow
                      key={client.clientId}
                      className={creating ? "opacity-60" : "cursor-pointer"}
                      aria-disabled={creating || undefined}
                      onClick={() => {
                        if (creating) return;
                        selectClient(client.clientId);
                      }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {creatingClientId === client.clientId ? (
                            <Spinner className="size-3.5" />
                          ) : null}
                          <div className="min-w-0">
                            {nameMatches ? (
                              <p className="font-medium">
                                <HighlightText text={client.name} query={q} />
                              </p>
                            ) : null}
                            {tradingMatches ? (
                              <p
                                className={cn(
                                  nameMatches
                                    ? "text-xs text-muted-foreground"
                                    : "font-medium",
                                )}
                              >
                                <HighlightText
                                  text={client.tradingName}
                                  query={q}
                                />
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
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
