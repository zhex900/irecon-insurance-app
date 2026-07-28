import { useEffect, useState } from "react";
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

type ClientHit = {
  clientId: number;
  name: string;
  tradingName: string;
};

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
  const [creatingClientId, setCreatingClientId] = useState<number | null>(null);
  const creating =
    creatingClientId != null &&
    navigation.state !== "idle" &&
    navigation.location?.pathname === "/policies/new";

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          type: "clients",
          limit: "25",
        });
        if (search.trim()) params.set("q", search.trim());
        const response = await fetch(`/api/search?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Search failed");
        const data = (await response.json()) as { clients: ClientHit[] };
        setClients(data.clients ?? []);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setClients([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, search]);

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
              {loading && clients.length === 0 ? (
                <TableRow>
                  <TableCell className="py-8 text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : clients.length === 0 ? (
                <TableRow>
                  <TableCell className="py-8 text-center text-muted-foreground">
                    No match.
                  </TableCell>
                </TableRow>
              ) : (
                clients.map((client) => (
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
                          <p className="font-medium">{client.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {client.tradingName}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          Showing up to 25 matching clients
        </p>
      </DialogContent>
    </Dialog>
  );
}
