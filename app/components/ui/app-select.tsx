import { useState, type ReactNode } from "react";

import { cn } from "~/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

/** Base UI disallows empty item values; map "" through this sentinel. */
const EMPTY_VALUE = "__app_select_empty__";

export type AppSelectOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

export type AppSelectProps = {
  options: readonly AppSelectOption[];
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  name?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  size?: "sm" | "default";
  className?: string;
  triggerClassName?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
};

function toItemValue(value: string): string {
  return value === "" ? EMPTY_VALUE : value;
}

function fromItemValue(value: string | null): string {
  if (value == null || value === EMPTY_VALUE) return "";
  return value;
}

function toSelectValue(value: string | null | undefined): string | null {
  if (value == null) return null;
  return toItemValue(value);
}

/** App-styled select (Base UI). Empty string option values are supported. */
export function AppSelect({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Select…",
  name,
  id,
  disabled,
  required,
  size = "default",
  className,
  triggerClassName,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: AppSelectProps) {
  const controlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? "");
  const current = controlled ? (value ?? "") : uncontrolled;
  const items = options.map((option) => ({
    value: toItemValue(option.value),
    label: option.label,
  }));

  return (
    <div className={cn("relative w-full", className)}>
      {name ? (
        <input
          type="hidden"
          name={name}
          value={current}
          required={required}
          disabled={disabled}
          readOnly
        />
      ) : null}
      <Select
        id={id}
        disabled={disabled}
        required={required}
        items={items}
        value={controlled ? toSelectValue(value) : toSelectValue(current)}
        onValueChange={(next) => {
          const resolved = fromItemValue(next);
          if (!controlled) setUncontrolled(resolved);
          onValueChange?.(resolved);
        }}
      >
        <SelectTrigger
          size={size}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          className={cn("w-full", triggerClassName)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} align="start">
          <SelectGroup>
            {options.map((option) => (
              <SelectItem
                key={toItemValue(option.value)}
                value={toItemValue(option.value)}
                disabled={option.disabled}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
