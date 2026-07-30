import { Link } from "react-router";
import type { ReactNode } from "react";
import { ArrowUpRightIcon } from "lucide-react";
import { StatusBadge } from "~/components/ui/status-badge";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "~/components/ui/popover";
import { formatDate, cn } from "~/lib/utils";

export type PolicySummaryPopoverPolicy = {
  policyId: number;
  policyNumber: string;
  insuredName?: string | null;
  clientName?: string | null;
  policyStatusId: number;
  policyStatusName: string;
  coverTypeName?: string | null;
  dateStart: string;
  dateEnd: string;
  isDraft?: boolean;
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

export function PolicySummaryPopover({
  policy,
  side = "bottom",
  className,
  children,
}: {
  policy: PolicySummaryPopoverPolicy;
  side?: "top" | "bottom" | "left" | "right" | "inline-end" | "inline-start";
  className?: string;
  children?: ReactNode;
}) {
  if (!policy.policyId) {
    return (
      <span className={cn("font-medium text-muted-foreground", className)}>
        {children ?? (policy.policyNumber || "—")}
      </span>
    );
  }

  const href = `/policies/${policy.policyId}`;
  const label = children ?? (policy.policyNumber || "—");

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        closeDelay={120}
        nativeButton={false}
        render={<span />}
        className={cn(
          "cursor-pointer font-medium text-current underline-offset-4 hover:text-primary hover:underline",
          className,
        )}
      >
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" side={side} className="w-80 gap-0 p-0">
        <div className="flex items-start justify-between gap-3 border-b p-3.5">
          <PopoverHeader className="min-w-0 gap-0.5">
            <PopoverTitle className="truncate text-base">
              {policy.policyNumber}
            </PopoverTitle>
            {policy.insuredName?.trim() ? (
              <PopoverDescription className="truncate">
                {policy.insuredName}
              </PopoverDescription>
            ) : null}
          </PopoverHeader>
          <StatusBadge
            statusId={policy.policyStatusId}
            name={policy.policyStatusName}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 p-3.5">
          <Detail label="Client" value={policy.clientName} />
          <Detail label="Cover" value={policy.coverTypeName} />
          <Detail label="Start" value={formatDate(policy.dateStart)} />
          <Detail label="End" value={formatDate(policy.dateEnd)} />
        </div>

        <div className="border-t p-2.5">
          <Button
            nativeButton={false}
            render={<Link to={href} />}
            size="sm"
            className="w-full"
          >
            Open policy
            <ArrowUpRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
