import { CheckIcon, ChevronDownIcon, ListFilterIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";

export type ColumnFilterOption = {
  value: string;
  label: string;
  count?: number;
};

export function ColumnFilterHeader({
  label,
  options,
  selected,
  onChange,
  align = "start",
}: {
  label: string;
  options: ColumnFilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  /** Local draft so multi-select (OR) stays responsive while the URL revalidates. */
  const [draft, setDraft] = useState(selected);
  const active = selected.length > 0;

  function handleOpenChange(next: boolean) {
    if (next) setDraft(selected);
    setOpen(next);
  }

  function toggle(value: string) {
    const next = draft.includes(value)
      ? draft.filter((item) => item !== value)
      : [...draft, value];
    setDraft(next);
    onChange(next);
  }

  function clear() {
    setDraft([]);
    onChange([]);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "-ml-1.5 inline-flex flex-nowrap items-center gap-1 rounded-md px-1.5 py-0.5 text-left text-sm font-medium whitespace-nowrap transition-colors hover:bg-muted",
              active && "bg-muted text-foreground",
            )}
          />
        }
      >
        <span className="shrink-0">{label}</span>
        {active ? (
          <span className="shrink-0 rounded-full bg-primary px-1.5 text-[10px] leading-4 font-semibold text-primary-foreground tabular-nums">
            {selected.length}
          </span>
        ) : (
          <ListFilterIcon className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <ChevronDownIcon
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-64 gap-1.5 p-2"
        onClick={(event) => event.stopPropagation()}
      >
        <PopoverHeader className="flex-row items-center justify-between px-1">
          <PopoverTitle className="text-xs tracking-wide text-muted-foreground uppercase">
            {label}
          </PopoverTitle>
          {draft.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="h-6 px-1.5 text-xs"
              onClick={clear}
            >
              Clear
            </Button>
          ) : null}
        </PopoverHeader>
        <div className="flex max-h-64 flex-col gap-0.5 overflow-auto">
          {options.map((option) => {
            const checked = draft.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                  checked && "bg-muted/70",
                )}
                onClick={() => toggle(option.value)}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-sm border",
                    checked
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background",
                  )}
                  aria-hidden
                >
                  {checked ? <CheckIcon className="size-3" /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.count != null ? (
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {option.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <p className="px-1 pt-0.5 text-[11px] text-muted-foreground">
          OR — select multiple values
        </p>
      </PopoverContent>
    </Popover>
  );
}
