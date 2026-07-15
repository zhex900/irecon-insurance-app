import { cn } from "~/lib/utils";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";

type FieldProps = {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
};

export function Field({ label, error, hint, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export function FieldInput(
  props: React.ComponentProps<typeof Input> & { label: string; error?: string; hint?: string },
) {
  const { label, error, hint, ...inputProps } = props;
  return (
    <Field label={label} error={error} hint={hint}>
      <Input aria-invalid={!!error} {...inputProps} />
    </Field>
  );
}

export function FieldTextarea(
  props: React.ComponentProps<typeof Textarea> & { label: string; error?: string; hint?: string },
) {
  const { label, error, hint, ...textareaProps } = props;
  return (
    <Field label={label} error={error} hint={hint}>
      <Textarea aria-invalid={!!error} {...textareaProps} />
    </Field>
  );
}
