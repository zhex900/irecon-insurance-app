"use client";

import type { ComponentProps, KeyboardEvent, MouseEvent } from "react";

import { TableCell, TableRow } from "~/components/ui/table";
import { cn } from "~/lib/utils";

const NESTED_INTERACTIVE_SELECTOR =
  "a, button, input, select, textarea, [role='checkbox'], [role='combobox']";

function isNestedInteractiveTarget(target: EventTarget | null) {
  return Boolean(
    (target as HTMLElement | null)?.closest(NESTED_INTERACTIVE_SELECTOR),
  );
}

function activateInteractiveRow(
  event: KeyboardEvent<HTMLTableRowElement>,
  onActivate: () => void,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onActivate();
  }
}

type InteractiveTableRowProps = Omit<
  ComponentProps<typeof TableRow>,
  "onClick" | "onKeyDown" | "tabIndex"
> & {
  "aria-label": string;
  onActivate: () => void;
  disabled?: boolean;
};

/** Focusable table row activated by click, Enter, or Space. Skips nested controls. */
function InteractiveTableRow({
  className,
  onActivate,
  disabled = false,
  "aria-label": ariaLabel,
  ...props
}: InteractiveTableRowProps) {
  function onClick(event: MouseEvent<HTMLTableRowElement>) {
    if (isNestedInteractiveTarget(event.target)) return;
    onActivate();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (isNestedInteractiveTarget(event.target)) return;
    activateInteractiveRow(event, onActivate);
  }

  return (
    <TableRow
      className={cn(!disabled && "cursor-pointer", className)}
      tabIndex={disabled ? undefined : 0}
      aria-label={disabled ? undefined : ariaLabel}
      onClick={disabled ? undefined : onClick}
      onKeyDown={disabled ? undefined : onKeyDown}
      {...props}
    />
  );
}

/** Table cell with nested buttons/links that must not activate the row. */
function InteractiveTableActionsCell({
  className,
  onClick,
  onKeyDown,
  ...props
}: ComponentProps<typeof TableCell>) {
  return (
    <TableCell
      className={className}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        onKeyDown?.(event);
      }}
      {...props}
    />
  );
}

export { InteractiveTableRow, InteractiveTableActionsCell };
