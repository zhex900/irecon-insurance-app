import { CheckIcon, ChevronDownIcon, ListFilterIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { DateInput } from "~/components/ui/date-input";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  dateRangeActive,
  type DateRangePreset,
  type DateRangeValue,
  isIsoDate,
} from "~/lib/search/date-range-filter";
import { cn } from "~/lib/utils";

export function ColumnDateFilterHeader({
  label,
  presets,
  value,
  onChange,
  rangeForPreset,
  presetCounts,
  align = "start",
  inputIdPrefix,
}: {
  label: string;
  presets: readonly DateRangePreset[];
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  rangeForPreset: (preset: string) => { from: string; to: string };
  /** Counts keyed by preset id (shown on the right of each quick option). */
  presetCounts?: Record<string, number>;
  align?: "start" | "center" | "end";
  inputIdPrefix: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const active = dateRangeActive(value);

  function handleOpenChange(next: boolean) {
    if (next) setDraft(value);
    setOpen(next);
  }

  function applyPreset(preset: string) {
    // Clicking the active preset unchecks it (same as Clear).
    if (draft.preset === preset) {
      clear();
      return;
    }
    const range = rangeForPreset(preset);
    const next: DateRangeValue = {
      from: range.from,
      to: range.to,
      preset,
    };
    setDraft(next);
    onChange(next);
  }

  function applyCustom(nextFrom: string, nextTo: string) {
    const from =
      nextFrom === "" ? null : isIsoDate(nextFrom) ? nextFrom : draft.from;
    const to = nextTo === "" ? null : isIsoDate(nextTo) ? nextTo : draft.to;
    const next: DateRangeValue = { from, to, preset: null };
    setDraft(next);
    onChange(next);
  }

  function clear() {
    const empty: DateRangeValue = { from: null, to: null, preset: null };
    setDraft(empty);
    onChange(empty);
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
            1
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
        className="w-72 gap-2 p-2"
        onClick={(event) => event.stopPropagation()}
      >
        <PopoverHeader className="flex-row items-center justify-between px-1">
          <PopoverTitle className="text-xs tracking-wide text-muted-foreground uppercase">
            {label}
          </PopoverTitle>
          {active || dateRangeActive(draft) ? (
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

        <div className="flex flex-col gap-0.5">
          {presets.map((preset) => {
            const checked = draft.preset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                  checked && "bg-muted/70",
                )}
                onClick={() => applyPreset(preset.id)}
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
                <span className="min-w-0 flex-1 truncate">{preset.label}</span>
                {presetCounts ? (
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {presetCounts[preset.id] ?? 0}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="border-t pt-2">
          <p className="mb-1.5 px-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Custom range
          </p>
          <div className="grid grid-cols-2 gap-2 px-1">
            <div className="flex min-w-0 flex-col gap-1">
              <Label htmlFor={`${inputIdPrefix}-from`} className="text-xs">
                From
              </Label>
              <DateInput
                id={`${inputIdPrefix}-from`}
                value={draft.from ?? ""}
                className="h-8"
                onChange={(next) => applyCustom(next, draft.to ?? "")}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <Label htmlFor={`${inputIdPrefix}-to`} className="text-xs">
                To
              </Label>
              <DateInput
                id={`${inputIdPrefix}-to`}
                value={draft.to ?? ""}
                className="h-8"
                onChange={(next) => applyCustom(draft.from ?? "", next)}
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
