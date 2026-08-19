import { ChevronsUpDownIcon, XIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Field, FieldLabel } from "~/components/ui/field";
import {
  FloatingListbox,
  useFloatingListPosition,
} from "~/components/ui/floating-listbox";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

import type { FormAutocompleteOption } from "./form-autocomplete";
import { valuesEqual } from "./utils";

/** Standalone autocomplete for list/filter bars (not react-hook-form). */
export function FilterAutocomplete({
  id,
  label,
  hideLabel = false,
  value,
  onChange,
  options,
  placeholder = "Search…",
  emptyMessage = "No match.",
  className,
}: {
  id: string;
  label: string;
  /** Keep label for a11y but hide it visually. */
  hideLabel?: boolean;
  value: string | number | "";
  onChange: (value: string | number | "") => void;
  options: FormAutocompleteOption[];
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
}) {
  const selected = options.find((item) => valuesEqual(item.value, value));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const blurTimer = useRef<number | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((item) => {
      const haystack = [item.label, item.secondary, item.searchText]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [options, query]);

  const displayValue = open ? query : selected ? selected.label : "";
  const position = useFloatingListPosition(anchorRef, open, filtered.length);

  function selectOption(item: FormAutocompleteOption) {
    onChange(item.value);
    setQuery("");
    setOpen(false);
  }

  function clearSelection() {
    onChange("");
    setQuery("");
  }

  const hasSelection = value !== "" && !!selected;

  const listbox = (
    <FloatingListbox id={`${id}-listbox`} open={open} position={position}>
      {filtered.length === 0 ? (
        <li className="px-2.5 py-2 text-muted-foreground">{emptyMessage}</li>
      ) : (
        filtered.map((item, index) => {
          const active = valuesEqual(item.value, value);
          const enterTarget = Boolean(query.trim()) && index === 0;
          return (
            <li key={String(item.value)} role="option">
              <button
                type="button"
                className={cn(
                  "flex w-full flex-col items-start rounded-md px-2.5 py-2 text-left hover:bg-muted",
                  active && "bg-accent text-accent-foreground",
                  enterTarget && !active && "bg-muted",
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(item)}
              >
                <span className="font-medium">{item.label}</span>
                {item.secondary ? (
                  <span className="text-xs text-muted-foreground">
                    {item.secondary}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })
      )}
    </FloatingListbox>
  );

  return (
    <Field
      className={cn("min-w-0", hideLabel ? "gap-0" : undefined, className)}
    >
      <FieldLabel htmlFor={id} className={hideLabel ? "sr-only" : undefined}>
        {label}
      </FieldLabel>
      <div ref={anchorRef} className="relative">
        <Input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={`${id}-listbox`}
          autoComplete="off"
          placeholder={placeholder}
          value={displayValue}
          onFocus={() => {
            if (blurTimer.current) window.clearTimeout(blurTimer.current);
            setQuery("");
            setOpen(true);
          }}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setOpen(true);
            if (!next.trim() && hasSelection) clearSelection();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            if (!open || filtered.length === 0) return;
            event.preventDefault();
            selectOption(filtered[0]!);
          }}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => {
              setOpen(false);
              setQuery("");
            }, 150);
          }}
          className={cn("pr-8", hasSelection && "pr-14")}
        />
        {hasSelection ? (
          <button
            type="button"
            className="absolute top-1/2 right-7 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            aria-label={`Clear ${label}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={clearSelection}
          >
            <XIcon className="size-3.5" />
          </button>
        ) : null}
        <ChevronsUpDownIcon className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      {listbox}
    </Field>
  );
}
