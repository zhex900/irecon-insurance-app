import type { ReactNode } from "react";
import {
  Controller,
  useController,
  useFormContext,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { cn } from "~/lib/utils";
import { AmountInput } from "~/components/ui/amount-input";
import { AppSelect, type AppSelectOption } from "~/components/ui/app-select";
import { DateInput } from "~/components/ui/date-input";
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

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  if (ref && typeof ref === "object") {
    (ref as React.RefObject<T | null>).current = value;
  }
}

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

/** App-styled select for RHF forms (FormProvider or explicit `control`). */
export function Select<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  name,
  control: controlProp,
  options,
  placeholder = "Please select...",
  label,
  error,
  hint,
  tooltip,
  id,
  required,
  disabled,
  className,
  onValueChange,
}: {
  name: TName;
  control?: Control<TFieldValues>;
  options: readonly AppSelectOption[];
  placeholder?: string;
  label?: string;
  error?: string;
  hint?: string;
  tooltip?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  onValueChange?: (value: string) => void;
}) {
  const formContext = useFormContext<TFieldValues>();
  const control = controlProp ?? formContext.control;
  const selectId = id ?? name;
  const { saved, className: highlight } = useFieldSaveState(name);

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const message = error ?? fieldState.error?.message;

        return (
          <Field
            data-invalid={message ? true : undefined}
            className={className}
          >
            {label ? (
              <div className="flex items-center gap-1.5">
                <FieldLabel htmlFor={selectId} required={required}>
                  {label}
                </FieldLabel>
                {tooltip ? (
                  <FormulaTooltip label={`${label} help`}>
                    {tooltip}
                  </FormulaTooltip>
                ) : null}
              </div>
            ) : null}
            <div className="relative">
              <AppSelect
                ref={(node) => assignRef(field.ref, node)}
                id={selectId}
                name={field.name}
                value={field.value == null ? "" : String(field.value)}
                onValueChange={(next) => {
                  field.onChange(next);
                  onValueChange?.(next);
                }}
                onBlur={field.onBlur}
                options={options}
                placeholder={placeholder}
                disabled={disabled}
                required={required}
                aria-invalid={!!message}
                // Highlight on the trigger (has the border) — not the wrapper.
                className={cn(saved && "pr-8")}
                triggerClassName={highlight}
              />
              <FieldSavedTick name={name} />
            </div>
            {hint ? <FieldDescription>{hint}</FieldDescription> : null}
            {message ? <FieldError>{message}</FieldError> : null}
          </Field>
        );
      }}
    />
  );
}

/** App-styled date field for RHF forms (`yyyy-MM-dd`). */
export function FieldDateInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  name,
  control,
  label,
  error,
  hint,
  tooltip,
  id,
  required,
  disabled,
  className,
  placeholder,
}: {
  name: TName;
  control?: Control<TFieldValues>;
  label: string;
  error?: string;
  hint?: string;
  tooltip?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  placeholder?: string;
}) {
  const formContext = useFormContext<TFieldValues>();
  const resolvedControl = control ?? formContext.control;
  const { field, fieldState } = useController({
    name,
    control: resolvedControl,
  });
  const fieldId = id ?? name;
  const { saved, className: highlight } = useFieldSaveState(name);
  const message = error ?? fieldState.error?.message;

  return (
    <Field data-invalid={message ? true : undefined} className={className}>
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
      <div className="relative">
        <DateInput
          id={fieldId}
          name={field.name}
          value={field.value == null ? "" : String(field.value)}
          onChange={field.onChange}
          onBlur={field.onBlur}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          aria-invalid={!!message}
          className={cn(highlight, saved && "pr-8")}
        />
        <FieldSavedTick name={name} />
      </div>
      {message ? <FieldError>{message}</FieldError> : null}
    </Field>
  );
}
