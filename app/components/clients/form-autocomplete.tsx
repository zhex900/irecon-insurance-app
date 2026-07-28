import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useController, useFormContext } from "react-hook-form";
import { ChevronsUpDownIcon } from "lucide-react";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

export type FormAutocompleteOption = {
  value: string | number;
  label: string;
  secondary?: string;
  /** Extra text used for filtering (in addition to label/secondary). */
  searchText?: string;
};

type ListPosition = {
  top: number;
  left: number;
  width: number;
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
  const [position, setPosition] = useState<ListPosition | null>(null);
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

  function updatePosition() {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, filtered.length]);

  useEffect(() => {
    if (!open) return;
    function onReposition() {
      updatePosition();
    }
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

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

  const listbox =
    open && position
      ? createPortal(
          <ul
            id={`${name}-listbox`}
            role="listbox"
            className="fixed z-50 max-h-56 overflow-auto rounded-lg border bg-popover p-1 text-sm shadow-md"
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
            }}
          >
            {filtered.length === 0 ? (
              <li className="px-2.5 py-2 text-muted-foreground">
                {emptyMessage}
              </li>
            ) : (
              filtered.map((item, index) => {
                const active = valuesEqual(item.value, field.value);
                const highlighted = index === 0;
                return (
                  <li key={String(item.value)} role="option">
                    <button
                      type="button"
                      className={cn(
                        "flex w-full flex-col items-start rounded-md px-2.5 py-2 text-left hover:bg-muted",
                        (active || highlighted) && "bg-muted",
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
          </ul>,
          document.body,
        )
      : null;

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

function valuesEqual(a: unknown, b: unknown) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return String(a) === String(b);
}
