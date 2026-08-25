import { cn } from "~/lib/utils";

const STATUS_DOT: Record<number, string> = {
  1: "bg-warning",
  2: "bg-success",
  3: "bg-muted-foreground",
};

export function StatusDot({
  statusId,
  className,
}: {
  statusId: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2.5 shrink-0 rounded-full",
        STATUS_DOT[statusId] ?? "bg-muted-foreground",
        className,
      )}
    />
  );
}
