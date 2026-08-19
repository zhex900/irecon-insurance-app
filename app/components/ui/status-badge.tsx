import type { ReactNode } from "react";

import { Badge } from "~/components/reui/badge";
import { cn } from "~/lib/utils";

const STATUS_VARIANT: Record<
  number,
  "warning-light" | "success-light" | "secondary"
> = {
  1: "warning-light",
  2: "success-light",
  3: "secondary",
};

export function StatusBadge({
  statusId,
  name,
  className,
}: {
  statusId: number;
  name: string;
  className?: string;
}) {
  return (
    <Badge
      variant={STATUS_VARIANT[statusId] ?? "outline"}
      size="default"
      radius="full"
      className={className}
    >
      {name}
    </Badge>
  );
}

export function FilterTag({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
