import { FieldError, FieldLabel } from "~/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "~/components/ui/input-group";
import {
  FieldSavedTick,
  useFieldSaveState,
} from "~/components/forms/field-save-highlight";
import {
  POLICY_NUMBER_PREFIX,
  composePolicyNumber,
  policyNumberSuffix,
} from "~/lib/policies/policy-number";
import { cn } from "~/lib/utils";

/**
 * Policy number control: fixed {@link POLICY_NUMBER_PREFIX} + editable suffix.
 * Form value is always the full number (prefix + suffix).
 */
export function PolicyNumberField({
  value,
  onChange,
  onBlur,
  disabled = false,
  required = false,
  error,
  id = "policyNumber",
  className,
  compact = false,
}: {
  value: string;
  onChange?: (fullPolicyNumber: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  id?: string;
  className?: string;
  /** Inline layout for Policy Information card (no outer Field label). */
  compact?: boolean;
}) {
  const { saved, className: highlight } = useFieldSaveState("policyNumber");
  const suffix = policyNumberSuffix(value ?? "");
  const editable = Boolean(onChange) && !disabled;

  const control = editable ? (
    <div className="relative min-w-0">
      <InputGroup
        className={cn(highlight, compact ? "max-w-xs" : undefined)}
        data-disabled={disabled ? true : undefined}
      >
        <InputGroupAddon align="inline-start">
          <InputGroupText>{POLICY_NUMBER_PREFIX}</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          name="policyNumber"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={suffix}
          aria-invalid={error ? true : undefined}
          aria-label="Policy number"
          autoComplete="off"
          spellCheck={false}
          className={cn(saved && "pr-8")}
          onChange={(event) => {
            onChange?.(composePolicyNumber(event.target.value));
          }}
          onBlur={onBlur}
        />
      </InputGroup>
      <FieldSavedTick name="policyNumber" />
    </div>
  ) : (
    <span className="text-sm font-medium text-foreground">
      {value?.trim() || "—"}
    </span>
  );

  if (compact) {
    return (
      <div className={cn("min-w-0", className)}>
        {control}
        {error ? <FieldError className="mt-1">{error}</FieldError> : null}
      </div>
    );
  }

  return (
    <div
      data-invalid={error ? true : undefined}
      className={cn("flex flex-col gap-2", className)}
    >
      <FieldLabel htmlFor={id} required={required}>
        Policy Number
      </FieldLabel>
      {control}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}
