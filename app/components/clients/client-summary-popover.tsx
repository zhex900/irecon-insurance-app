import { Link } from "react-router";
import type { ReactNode } from "react";
import { ArrowUpRightIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";

export type ClientSummaryPopoverClient = {
  clientId: number;
  name: string;
  tradingName?: string | null;
  abn?: string | null;
  phone?: string | null;
  email?: string | null;
  accountManagerName?: string | null;
};

function Detail({ label, value }: { label: string; value?: string | null }) {
  const text = value?.trim() ? value : "—";
  return (
    <div className="min-w-0">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="truncate text-sm font-medium">{text}</p>
    </div>
  );
}

function clientInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ClientSummaryPopover({
  client,
  className,
  children,
}: {
  client: ClientSummaryPopoverClient;
  className?: string;
  children?: ReactNode;
}) {
  if (!client.clientId) {
    return (
      <span className={cn("font-medium text-muted-foreground", className)}>
        {children ?? (client.name || "—")}
      </span>
    );
  }

  const href = `/clients/${client.clientId}`;
  const label = children ?? (client.name || "—");

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        closeDelay={120}
        className={cn(
          "cursor-pointer font-medium text-foreground underline-offset-4 hover:text-primary hover:underline",
          className,
        )}
      >
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-80 gap-0 p-0">
        <div className="flex items-start gap-3 border-b p-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
            {clientInitials(client.name)}
          </div>
          <PopoverHeader className="min-w-0 gap-0.5">
            <PopoverTitle className="truncate text-base">
              {client.name}
            </PopoverTitle>
            {client.tradingName?.trim() ? (
              <PopoverDescription className="truncate">
                {client.tradingName}
              </PopoverDescription>
            ) : null}
          </PopoverHeader>
        </div>

        <div className="grid grid-cols-2 gap-3 p-3.5">
          <Detail label="ABN" value={client.abn} />
          <Detail label="Phone" value={client.phone} />
          <Detail label="Email" value={client.email} />
          <Detail label="Account manager" value={client.accountManagerName} />
        </div>

        <div className="border-t p-2.5">
          <Button
            nativeButton={false}
            render={<Link to={href} />}
            size="sm"
            className="w-full"
          >
            Open client
            <ArrowUpRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
