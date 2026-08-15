import { useMemo, useRef, useState } from "react";
import { useController, useFormContext } from "react-hook-form";
import { ChevronsUpDownIcon } from "lucide-react";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import {
  FloatingListbox,
  useFloatingListPosition,
} from "~/components/ui/floating-listbox";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { valuesEqual } from "./utils";

export type FormAutocompleteOption = {
  value: string | number;
  label: string;
  secondary?: string;
  /** Extra text used for filtering (in addition to label/secondary). */
  searchText?: string;
};

export function FormAutocomplete({
  name,
  label,
  error,
  options,
  placeholder = "Search…",
  emptyValue = 0,
  emptyMessage = "No match.",
  required,
}: {
  name: string;
  label: string;
  error?: string;
  options: FormAutocompleteOption[];
  placeholder?: string;
  emptyValue?: string | number;
  emptyMessage?: string;
  required?: boolean;
}) {
  const { control, setValue } = useFormContext();
  const { field } = useController({ name, control });

  const selected = options.find((item) => valuesEqual(item.value, field.value));

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
    setValue(name, item.value, {
      shouldDirty: true,
      shouldValidate: true,
      shouldTouch: true,
    });
    field.onChange(item.value);
    setQuery("");
    setOpen(false);
  }

  function clearSelection() {
    setValue(name, emptyValue, {
      shouldDirty: true,
      shouldValidate: true,
      shouldTouch: true,
    });
    field.onChange(emptyValue);
    setQuery("");
  }

  const hasSelection = !valuesEqual(field.value, emptyValue) && !!selected;

  const listbox = (
    <FloatingListbox id={`${name}-listbox`} open={open} position={position}>
      {filtered.length === 0 ? (
        <li className="px-2.5 py-2 text-muted-foreground">{emptyMessage}</li>
      ) : (
        filtered.map((item, index) => {
          const active = valuesEqual(item.value, field.value);
          // First match is Enter-target only while filtering; avoid a permanent gray bar.
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
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={name} required={required}>
        {label}
      </FieldLabel>
      <div ref={anchorRef} className="relative">
        <Input
          id={name}
          name={name}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={`${name}-listbox`}
          aria-invalid={!!error}
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
              field.onBlur();
            }, 150);
          }}
          className="pr-8"
        />
        <ChevronsUpDownIcon className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>

      {listbox}

      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}
