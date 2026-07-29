import type { ReactNode } from "react";
import { cn } from "~/lib/utils";
import { AmountInput } from "~/components/ui/amount-input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "~/components/ui/field";
import { FormulaTooltip } from "~/components/ui/formula-tooltip";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  FieldSavedTick,
  useFieldSaveState,
} from "~/components/forms/field-save-highlight";

/** RHF-friendly labeled input on top of shadcn Field. */
export function FieldInput({
  label,
  error,
  hint,
  tooltip,
  className,
  id,
  prefix,
  required,
  ...inputProps
}: React.ComponentProps<typeof Input> & {
  label: string;
  error?: string;
  hint?: string;
  tooltip?: ReactNode;
  required?: boolean;
  /** Leading addon inside the control (e.g. "$"). Enables comma formatting. */
  prefix?: string;
}) {
  const fieldId = id ?? inputProps.name;
  const name =
    typeof inputProps.name === "string" ? inputProps.name : undefined;
  const { saved, className: highlight } = useFieldSaveState(name);
  const isCurrency = prefix === "$" && Boolean(name);

  return (
    <Field data-invalid={error ? true : undefined} className={className}>
      <div className="flex w-full items-start gap-1.5">
        <FieldLabel
          htmlFor={fieldId}
          required={required}
          className="w-auto min-w-0 flex-1"
        >
          {label}
        </FieldLabel>
        {tooltip ? (
          <FormulaTooltip label={`${label} help`}>{tooltip}</FormulaTooltip>
        ) : null}
      </div>
      {hint != null ? (
        <FieldDescription className={hint ? undefined : "invisible"}>
          {hint || "\u00a0"}
        </FieldDescription>
      ) : null}
      <div className="flex min-w-0 flex-col gap-2">
        {isCurrency && name ? (
          <AmountInput
            name={name}
            id={typeof fieldId === "string" ? fieldId : name}
            aria-invalid={!!error}
            type={inputProps.type}
            inputMode={inputProps.inputMode ?? "decimal"}
            disabled={inputProps.disabled}
            readOnly={inputProps.readOnly}
            placeholder={inputProps.placeholder}
            onBlur={inputProps.onBlur}
          />
        ) : (
          <div className="relative">
            <Input
              id={fieldId}
              aria-invalid={!!error}
              className={cn(highlight, saved && "pr-8")}
              {...inputProps}
            />
            <FieldSavedTick name={name} />
          </div>
        )}
        {error ? <FieldError>{error}</FieldError> : null}
      </div>
    </Field>
  );
}

export function FieldTextarea({
  label,
  error,
  hint,
  tooltip,
  className,
  id,
  required,
  ...textareaProps
}: React.ComponentProps<typeof Textarea> & {
  label?: string;
  error?: string;
  hint?: string;
  tooltip?: ReactNode;
  required?: boolean;
}) {
  const fieldId = id ?? textareaProps.name;
  const name =
    typeof textareaProps.name === "string" ? textareaProps.name : undefined;
  const { saved, className: highlight } = useFieldSaveState(name);
  return (
    <Field data-invalid={error ? true : undefined} className={className}>
      {label || tooltip ? (
        <div className="flex items-center gap-1.5">
          {label ? (
            <FieldLabel htmlFor={fieldId} required={required}>
              {label}
            </FieldLabel>
          ) : null}
          {tooltip ? (
            <FormulaTooltip label={`${label ?? "Field"} help`}>
              {tooltip}
            </FormulaTooltip>
          ) : null}
        </div>
      ) : null}
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
      <div className="relative">
        <Textarea
          id={fieldId}
          aria-invalid={!!error}
          className={cn(highlight, saved && "pr-8")}
          {...textareaProps}
        />
        <FieldSavedTick name={name} className="top-2.5 translate-y-0" />
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}

/** Native select styled for dense insurance forms (works with RHF register). */
export function Select({
  className,
  label,
  error,
  hint,
  tooltip,
  id,
  required,
  children,
  ...props
}: React.ComponentProps<"select"> & {
  label?: string;
  error?: string;
  hint?: string;
  tooltip?: ReactNode;
  required?: boolean;
}) {
  const selectId = id ?? props.name;
  const name = typeof props.name === "string" ? props.name : undefined;
  const { saved, className: highlight } = useFieldSaveState(name);
  return (
    <Field data-invalid={error ? true : undefined}>
      {label ? (
        <div className="flex items-center gap-1.5">
          <FieldLabel htmlFor={selectId} required={required}>
            {label}
          </FieldLabel>
          {tooltip ? (
            <FormulaTooltip label={`${label} help`}>{tooltip}</FormulaTooltip>
          ) : null}
        </div>
      ) : null}
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={!!error}
          className={cn(
            "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
            highlight,
            saved && "pr-8",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <FieldSavedTick name={name} />
      </div>
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}
