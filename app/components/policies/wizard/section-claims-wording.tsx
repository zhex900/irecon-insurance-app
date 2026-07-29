import {
  useFormContext,
  Controller,
  type Control,
  type FieldError as RhfFieldError,
} from "react-hook-form";
import { useFieldSaveState } from "~/components/forms/field-save-highlight";
import { Checkbox } from "~/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import {
  FieldInput,
  FieldTextarea,
  Select,
} from "~/components/ui/form-controls";
import { cn } from "~/lib/utils";
import { type CarPolicyFormValues } from "~/lib/zod/policy-car";
import type { CarWording } from "~/lib/db/types";
import { Section } from "./section-shared";
import { CustomWordingsEditor } from "./section-custom-wordings";

export function ClaimsWordingStep({
  carWording,
}: {
  carWording: CarWording[];
}) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<CarPolicyFormValues>();

  return (
    <div className="flex flex-col gap-8">
      <Section title="Claims History">
        <div className="flex flex-col gap-4">
          <FieldInput
            label="Number of claims last 3 years"
            required
            type="text"
            inputMode="numeric"
            error={errors.claimsCountLast3Years?.message}
            {...register("claimsCountLast3Years")}
          />
          <Select
            label="Have any claims exceeded $20,000 in value?"
            required
            error={errors.anyClaimsExceed20k?.message}
            {...register("anyClaimsExceed20k")}
          >
            <option value="">Please select...</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </Select>
        </div>
      </Section>

      <Section title="Excluded Contracts">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            These can be added subject to referral and individual acceptance.
          </p>
          <FieldTextarea
            aria-label="Excluded contracts introduction"
            rows={3}
            {...register("excludedContracts1")}
          />
          <FieldTextarea
            aria-label="Excluded contracts activities"
            rows={10}
            {...register("excludedContracts2")}
          />
          <FieldTextarea
            aria-label="Excluded contracts definitions"
            rows={5}
            {...register("excludedContracts3")}
          />
        </div>
      </Section>

      <Section title="Premium Adjustment">
        <p className="text-sm text-foreground">
          Minimum Premium 75% of declared turnover
        </p>
      </Section>

      <Section title="General Disclosure" className="bg-muted/40">
        <GeneralDisclosureField
          control={control}
          error={errors.declarationConfirmed}
        />
      </Section>

      <Section title="Additional Wording">
        <div className="flex flex-col gap-3">
          {carWording.map((item) => (
            <Controller
              key={item.carWordingId}
              control={control}
              name="selectedWordingIds"
              render={({ field }) => {
                const selected = field.value ?? [];
                const checked = selected.includes(item.carWordingId);
                return (
                  <label className="flex items-start gap-3 rounded-md border border-border p-3 text-foreground">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...selected, item.carWordingId]
                          : selected.filter((id) => id !== item.carWordingId);
                        field.onChange(next);
                      }}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-medium text-foreground">
                        {item.subject}
                      </span>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {item.content}
                      </p>
                    </span>
                  </label>
                );
              }}
            />
          ))}
          <CustomWordingsEditor />
        </div>
      </Section>
    </div>
  );
}

function GeneralDisclosureField({
  control,
  error,
}: {
  control: Control<CarPolicyFormValues>;
  error?: RhfFieldError;
}) {
  const { attention, className: highlight } = useFieldSaveState(
    "declarationConfirmed",
  );

  return (
    <Controller
      control={control}
      name="declarationConfirmed"
      render={({ field }) => (
        <div
          className={cn(
            "rounded-lg transition-[border-color,box-shadow] duration-300",
            attention && "border border-warning p-3 ring-2 ring-warning/25",
          )}
        >
          <Field
            orientation="horizontal"
            data-invalid={!attention && error ? true : undefined}
          >
            <Checkbox
              id="declarationConfirmed"
              ref={field.ref}
              checked={field.value === true}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              onBlur={field.onBlur}
              aria-invalid={!attention && !!error}
              className={cn(highlight)}
            />
            <FieldLabel
              htmlFor="declarationConfirmed"
              required
              className="font-normal"
            >
              Confirm you have asked and received responses from the client in
              relation to their Duty of Disclosure (as per IA)
            </FieldLabel>
            {!attention && error?.message ? (
              <FieldError>{error.message}</FieldError>
            ) : null}
          </Field>
        </div>
      )}
    />
  );
}
