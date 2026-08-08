import { useState } from "react";
import {
  useFormContext,
  Controller,
  type Control,
  type FieldError as RhfFieldError,
} from "react-hook-form";
import { useFieldSaveState } from "~/components/forms/field-save-highlight";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { WordingHtmlView } from "~/components/policies/wording-html-view";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import {
  FieldInput,
  FieldTextarea,
  Select,
} from "~/components/ui/form-controls";
import { cn } from "~/lib/utils";
import { plainTextFromWordingHtml } from "~/lib/policies/wording/html";
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
  const [wordingDialog, setWordingDialog] = useState<CarWording | null>(null);

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
            name="anyClaimsExceed20k"
            label="Have any claims exceeded $20,000 in value?"
            required
            error={errors.anyClaimsExceed20k?.message}
            options={[
              { value: "", label: "Please select..." },
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ]}
          />{" "}
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

      <GeneralDisclosureSection
        control={control}
        error={errors.declarationConfirmed}
      />

      <Section title="Additional Wording">
        <div className="flex flex-col gap-3">
          {carWording.map((item) => (
            <Controller
              key={item.carWordingId}
              control={control}
              name="selectedWordingIds"
              render={({ field }) => {
                const selected = (field.value ?? []).map(Number);
                const checked = selected.includes(item.carWordingId);
                return (
                  <label className="flex items-start gap-3 rounded-md border border-border p-3 text-foreground">
                    <Checkbox
                      id={`selectedWording-${item.carWordingId}`}
                      checked={checked}
                      onCheckedChange={(value) => {
                        const next =
                          value === true
                            ? [...selected, item.carWordingId]
                            : selected.filter(
                                (id) => id !== item.carWordingId,
                              );
                        field.onChange(next);
                      }}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <button
                        type="button"
                        className="text-left font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setWordingDialog(item);
                        }}
                      >
                        {plainTextFromWordingHtml(item.subject) || item.subject}
                      </button>
                      <WordingHtmlView
                        html={item.content}
                        className="mt-1 text-xs text-muted-foreground"
                        clampLines={2}
                      />
                    </span>
                  </label>
                );
              }}
            />
          ))}
          <CustomWordingsEditor />
        </div>
      </Section>

      <Dialog
        open={wordingDialog != null}
        onOpenChange={(open) => {
          if (!open) setWordingDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {wordingDialog
                ? plainTextFromWordingHtml(wordingDialog.subject) ||
                  wordingDialog.subject
                : "Wording"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Full additional wording text
            </DialogDescription>
          </DialogHeader>
          {wordingDialog ? (
            <WordingHtmlView
              html={wordingDialog.content}
              className="max-h-[min(70vh,32rem)] overflow-y-auto text-foreground"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GeneralDisclosureSection({
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
    <Section
      title="General Disclosure"
      className={cn(
        // Transparent base border so shared `border-warning` highlight shows
        // the same yellow outline as text inputs (cards use ring by default).
        "border border-transparent bg-muted/40 transition-[border-color,box-shadow] duration-300",
        highlight,
        attention && "ring-warning",
      )}
    >
      <Controller
        control={control}
        name="declarationConfirmed"
        render={({ field }) => (
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
        )}
      />
    </Section>
  );
}
