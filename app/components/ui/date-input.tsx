import { useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
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

/** App-styled date field (Popover + Calendar). Value is `yyyy-MM-dd`. */
export function DateInput({
  id,
  name,
  value,
  defaultValue,
  onChange,
  onBlur,
  disabled,
  required,
  placeholder = "Pick a date",
  className,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
}: DateInputProps) {
  const controlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);

  const iso = controlled ? (value ?? "") : uncontrolled;
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
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              disabled={disabled}
              aria-invalid={ariaInvalid}
              aria-label={ariaLabel}
              className={cn(
                "w-full justify-start font-normal",
                !iso && "text-muted-foreground",
              )}
            />
          }
        >
          <CalendarIcon data-icon="inline-start" />
          {selected ? format(selected, "dd MMM yyyy") : placeholder}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => {
              if (!date) {
                commit("");
                return;
              }
              commit(toIsoDate(date));
              setOpen(false);
              onBlur?.();
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
