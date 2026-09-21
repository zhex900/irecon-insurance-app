import { format, isValid, parse, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { isIsoDate, toIsoDate } from "~/lib/search/date-range-filter";
import { cn } from "~/lib/utils";

function parseIsoDate(value: string | null | undefined): Date | undefined {
  if (!isIsoDate(value)) return undefined;
  const date = parseISO(value);
  return isValid(date) ? date : undefined;
}

const INPUT_DATE_FORMAT = "dd/MM/yyyy";

function parseInputDate(value: string): Date | undefined {
  const date = parse(value, INPUT_DATE_FORMAT, new Date());
  return isValid(date) && format(date, INPUT_DATE_FORMAT) === value
    ? date
    : undefined;
}

function formatInputDate(value: string | null | undefined): string {
  const date = parseIsoDate(value);
  return date ? format(date, INPUT_DATE_FORMAT) : "";
}

export type DateInputProps = {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (iso: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
};

/** App-styled editable date field (Popover + Calendar). Value is `yyyy-MM-dd`. */
export function DateInput({
  id,
  name,
  value,
  defaultValue,
  onChange,
  onBlur,
  disabled,
  required,
  placeholder = INPUT_DATE_FORMAT,
  className,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
}: DateInputProps) {
  const controlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? "");
  const [draft, setDraft] = useState(() =>
    formatInputDate(value ?? defaultValue),
  );
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);

  const iso = controlled ? (value ?? "") : uncontrolled;
  const inputValue = editing ? draft : formatInputDate(iso);
  const selected = parseIsoDate(iso);

  function commit(next: string) {
    if (!controlled) setUncontrolled(next);
    onChange?.(next);
  }

  return (
    <div className={cn("relative w-full", className)}>
      {name ? (
        <input
          type="hidden"
          name={name}
          value={iso}
          required={required}
          readOnly
        />
      ) : null}
      <Popover
        open={open}
        modal={false}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) onBlur?.();
        }}
      >
        <Input
          id={id}
          type="text"
          value={inputValue}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-invalid={ariaInvalid}
          aria-label={ariaLabel}
          className="pr-9"
          onChange={(event) => {
            const next = event.target.value;
            setEditing(true);
            setDraft(next);
            if (next === "") {
              commit("");
              return;
            }
            const date = parseInputDate(next);
            if (date) commit(toIsoDate(date));
          }}
          onBlur={() => {
            if (draft !== "" && !parseInputDate(draft)) {
              setDraft(formatInputDate(iso));
            }
            setEditing(false);
            onBlur?.();
          }}
        />
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={disabled}
              aria-label={ariaLabel ? `${ariaLabel} calendar` : "Open calendar"}
              className="absolute top-1/2 right-1 -translate-y-1/2"
            />
          }
        >
          <CalendarIcon aria-hidden className="text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => {
              if (!date) {
                commit("");
                setEditing(false);
                return;
              }
              commit(toIsoDate(date));
              setEditing(false);
              setOpen(false);
              onBlur?.();
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
