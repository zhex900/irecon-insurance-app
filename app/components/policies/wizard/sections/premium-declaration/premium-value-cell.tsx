import { useState } from "react";

import { Input } from "~/components/ui/input";
import { TableCell } from "~/components/ui/table";
import { sanitizeAmountInput } from "~/lib/amount-input";
import { cn, formatCurrency } from "~/lib/utils";

function PremiumValueEditor({
  draft,
  className,
  onDraftChange,
  onCommit,
  onCancel,
}: {
  draft: string;
  className: string;
  onDraftChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <TableCell className="py-1 pl-4 text-right">
      <Input
        autoFocus
        type="text"
        inputMode="decimal"
        className={cn(
          "h-7 w-full min-w-0 text-right font-normal tabular-nums",
          className,
        )}
        value={draft}
        aria-label="Edit premium value"
        onChange={(event) =>
          onDraftChange(sanitizeAmountInput(event.target.value))
        }
        onBlur={onCommit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") onCancel();
        }}
      />
    </TableCell>
  );
}

function PremiumValueDisplay({
  label,
  value,
  cellClass,
  valueClass,
  className,
  manual,
  onEdit,
}: {
  label: string;
  value: number;
  cellClass: string;
  valueClass: string;
  className: string;
  manual: boolean;
  onEdit: () => void;
}) {
  return (
    <TableCell className={cellClass} aria-label={label}>
      <button
        type="button"
        className={cn(
          "inline-flex w-full justify-end rounded px-0 text-right underline-offset-2 hover:bg-muted/60 hover:underline",
          valueClass,
          className,
        )}
        title={manual ? "Manually adjusted — click to edit" : "Click to edit"}
        onClick={onEdit}
      >
        {formatCurrency(value)}
      </button>
    </TableCell>
  );
}

export function PremiumValueCell({
  label,
  value,
  editable = false,
  manual = false,
  attention = false,
  className = "",
  onChange,
}: {
  label: string;
  value?: number;
  editable?: boolean;
  manual?: boolean;
  attention?: boolean;
  className?: string;
  onChange?: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const cellClass = "py-2 pl-4 text-right whitespace-nowrap tabular-nums";
  if (value == null) return <TableCell className={cellClass} />;
  const valueClass = cn(
    (manual || attention) && "font-medium text-warning",
    attention && "animate-pulse font-semibold",
  );
  if (!editable || !onChange) {
    return (
      <TableCell
        className={cn(cellClass, valueClass, className)}
        aria-label={label}
      >
        {formatCurrency(value)}
      </TableCell>
    );
  }
  if (editing) {
    return (
      <PremiumValueEditor
        draft={draft}
        className={className}
        onDraftChange={setDraft}
        onCommit={() => {
          const parsed = Number(draft.replace(/,/g, ""));
          if (!Number.isNaN(parsed)) onChange(parsed);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }
  return (
    <PremiumValueDisplay
      label={label}
      value={value}
      cellClass={cellClass}
      valueClass={valueClass}
      className={className}
      manual={manual}
      onEdit={() => {
        setDraft(String(value));
        setEditing(true);
      }}
    />
  );
}
