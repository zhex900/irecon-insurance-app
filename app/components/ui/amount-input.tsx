import { useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { CheckIcon } from "lucide-react";
import {
  formatAmountInput,
  sanitizeAmountInput,
} from "~/lib/amount-input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "~/components/ui/input-group";
import { useFieldSaveState } from "~/components/forms/field-save-highlight";
import { cn } from "~/lib/utils";

type AmountInputProps = Omit<
  React.ComponentProps<typeof InputGroupInput>,
  "value" | "onChange" | "name"
> & {
  name: string;
  /** When false, no leading $ (still comma-formats). Default true. */
  showCurrencySymbol?: boolean;
};

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  if (ref && typeof ref === "object") {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
}

function rawAmountValue(value: string | number | null | undefined): string {
  if (value == null || value === "") return "";
  return sanitizeAmountInput(String(value));
}

/**
 * Controlled currency/amount input: shows thousands separators when blurred,
 * plain digits while focused so the caret does not jump.
 */
export function AmountInput({
  name,
  showCurrencySymbol = true,
  className,
  id,
  ...inputProps
}: AmountInputProps) {
  const { control } = useFormContext();
  const { saved, className: highlight } = useFieldSaveState(name);
  const fieldId = id ?? name;
  const [focused, setFocused] = useState(false);

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <InputGroup className={cn(highlight, className)}>
          {showCurrencySymbol ? (
            <InputGroupAddon align="inline-start">
              <InputGroupText>$</InputGroupText>
            </InputGroupAddon>
          ) : null}
          <InputGroupInput
            id={fieldId}
            inputMode="decimal"
            autoComplete="off"
            {...inputProps}
            name={field.name}
            ref={(node) => assignRef(field.ref, node)}
            value={
              focused
                ? rawAmountValue(field.value)
                : formatAmountInput(field.value as string | number)
            }
            onFocus={(event) => {
              setFocused(true);
              inputProps.onFocus?.(event);
            }}
            onBlur={(event) => {
              setFocused(false);
              field.onBlur();
              inputProps.onBlur?.(event);
            }}
            onChange={(event) => {
              field.onChange(sanitizeAmountInput(event.target.value));
            }}
          />
          {saved ? (
            <InputGroupAddon align="inline-end">
              <CheckIcon className="size-3.5 text-success" aria-hidden />
            </InputGroupAddon>
          ) : null}
        </InputGroup>
      )}
    />
  );
}
