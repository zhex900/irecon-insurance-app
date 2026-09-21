import { CheckIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useFormContext } from "react-hook-form";

import { useFieldSaveState } from "~/components/forms/field-save-highlight";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "~/components/ui/input-group";
import { formatAmountInput, sanitizeAmountInput } from "~/lib/amount-input";
import { cn } from "~/lib/utils";

type AmountInputProps = Omit<
  React.ComponentProps<typeof InputGroupInput>,
  "value" | "onChange" | "name"
> & {
  name: string;
  /** When false, no leading $ (still comma-formats). Default true. */
  showCurrencySymbol?: boolean;
  /** Allow the excesses section to store the literal N/A value. */
  allowNA?: boolean;
  /** Hide the manual "Set N/A" button while still allowing N/A display/typing. */
  showNAButton?: boolean;
};

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  if (ref && typeof ref === "object") {
    (ref as React.RefObject<T | null>).current = value;
  }
}

function rawAmountValue(value: string | number | null | undefined): string {
  if (value == null || value === "") return "";
  return sanitizeAmountInput(String(value));
}

function normalizeInputValue(value: string, allowNA: boolean): string {
  if (allowNA) return value;
  return sanitizeAmountInput(value);
}

function displayAmountValue(
  value: string | number | null | undefined,
  allowNA: boolean,
  focused: boolean,
): string {
  if (value == null || value === "") return "";
  if (allowNA) {
    const text = String(value);
    if (focused || !/^\d+(?:\.\d+)?$/.test(text.replace(/,/g, ""))) {
      return text;
    }
  }
  return focused ? rawAmountValue(value) : formatAmountInput(value);
}

/**
 * Controlled currency/amount input: shows thousands separators when blurred,
 * plain digits while focused so the caret does not jump.
 */
export function AmountInput({
  name,
  showCurrencySymbol = true,
  allowNA = false,
  showNAButton = true,
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
            value={displayAmountValue(field.value, allowNA, focused)}
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
              field.onChange(normalizeInputValue(event.target.value, allowNA));
            }}
          />
          {allowNA && showNAButton ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label="Set N/A"
                title="Set N/A"
                disabled={inputProps.disabled}
                onClick={() => field.onChange("N/A")}
              >
                <XIcon />
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
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
