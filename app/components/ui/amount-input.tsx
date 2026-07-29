import { useLayoutEffect, useRef } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { CheckIcon } from "lucide-react";
import {
  formatAmountInput,
  mapAmountCaret,
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

/**
 * Controlled currency/amount input: shows thousands separators, stores a bare
 * numeric string (no commas) in RHF so zod coerce/regex keep working.
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingCaretRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const caret = pendingCaretRef.current;
    if (!input || caret == null) return;
    pendingCaretRef.current = null;
    input.setSelectionRange(caret, caret);
  });

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
            ref={(node) => {
              inputRef.current = node;
              assignRef(field.ref, node);
            }}
            value={formatAmountInput(field.value as string | number)}
            onFocus={(event) => {
              inputProps.onFocus?.(event);
              // Select existing value (incl. 0) so typing replaces it — do not
              // clear zeros; 0 is a valid amount for several money fields.
              event.currentTarget.select();
            }}
            onBlur={(event) => {
              field.onBlur();
              inputProps.onBlur?.(event);
            }}
            onChange={(event) => {
              const input = event.target;
              const caret = input.selectionStart ?? input.value.length;
              const next = sanitizeAmountInput(input.value);
              const formatted = formatAmountInput(next);
              pendingCaretRef.current = mapAmountCaret(
                input.value,
                caret,
                formatted,
              );
              field.onChange(next);
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
