import type { ReactNode } from "react";
import { useFormContext } from "react-hook-form";

import {
  FieldSavedTick,
  useFieldSaveState,
} from "~/components/forms/field-save-highlight";
import { AmountInput } from "~/components/ui/amount-input";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "~/components/ui/field";
import { FormulaTooltip } from "~/components/ui/formula-tooltip";
import { Input } from "~/components/ui/input";
import type { ReferenceData } from "~/lib/db/types";
import type { ExcessFieldConfig } from "~/lib/policies/excesses";
import type { SubLimitFieldConfig } from "~/lib/policies/sub-limits";
import { cn } from "~/lib/utils";
import { type CarPolicyFormValues } from "~/lib/zod/policy-car";

export function SubLimitField({ field }: { field: SubLimitFieldConfig }) {
  const {
    register,
    formState: { errors },
  } = useFormContext<CarPolicyFormValues>();
  const error = errors.subLimits?.[field.key]?.message;
  const inputId = `subLimits.${field.key}`;
  const { saved, className: highlight } = useFieldSaveState(inputId);

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={inputId} required>
        {field.label}
      </FieldLabel>
      <div className="relative">
        <Input
          id={inputId}
          type="text"
          aria-invalid={!!error}
          className={cn(highlight, saved && "pr-8")}
          {...register(`subLimits.${field.key}`)}
        />
        <FieldSavedTick name={inputId} />
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}

export function ExcessField({
  field,
  className,
}: {
  field: ExcessFieldConfig;
  className?: string;
}) {
  const {
    formState: { errors },
  } = useFormContext<CarPolicyFormValues>();
  const error = errors.excesses?.[field.key]?.message;
  const inputId = `excesses.${field.key}`;

  return (
    <Field data-invalid={error ? true : undefined} className={className}>
      <div className="flex items-center gap-1.5">
        <FieldLabel htmlFor={inputId} required>
          {field.label}
        </FieldLabel>
        {field.tooltip ? (
          <FormulaTooltip label={`${field.label} help`}>
            {field.tooltip}
          </FormulaTooltip>
        ) : null}
      </div>
      <AmountInput
        name={inputId}
        id={inputId}
        type="text"
        aria-invalid={!!error}
      />
      {field.description ? (
        <FieldDescription>{field.description}</FieldDescription>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}

export function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function applyAnnualCoverTypeDefaults(
  annualCoverTypeId: number,
  reference: ReferenceData,
  setValue: ReturnType<typeof useFormContext<CarPolicyFormValues>>["setValue"],
) {
  if (annualCoverTypeId === 1) {
    setValue(
      "insuredContracts",
      reference.defaultTexts.insuredContractsAnnualTransfer,
      { shouldDirty: true, shouldValidate: false },
    );
    return;
  }
  if (annualCoverTypeId === 2) {
    setValue(
      "insuredContracts",
      reference.defaultTexts.insuredContractsAnnualContractCommencing,
      { shouldDirty: true, shouldValidate: false },
    );
  }
}

export function applyCoverTypeDefaults(
  coverTypeId: number,
  reference: ReferenceData,
  setValue: ReturnType<typeof useFormContext<CarPolicyFormValues>>["setValue"],
  getValues: ReturnType<
    typeof useFormContext<CarPolicyFormValues>
  >["getValues"],
) {
  if (coverTypeId === 1) {
    setValue("annualCoverTypeId", null, { shouldDirty: true });
    setValue("insuredContracts", "", { shouldDirty: true });
    setValue(
      "geographicalScopes",
      reference.defaultTexts.geographicalScopeAnnual,
      { shouldDirty: true },
    );
    setValue("maximumConstructionPeriod", 18, {
      shouldDirty: true,
      shouldValidate: false,
    });
    setValue("subLimits", { ...reference.defaultSubLimits.annual });
    return;
  }

  setValue("annualCoverTypeId", null, { shouldDirty: true });
  // Single / Owner Builder: clear annual default; field mirrors site address.
  setValue("geographicalScopes", getValues("siteAddress")?.trim() ?? "", {
    shouldDirty: true,
  });
  if (coverTypeId === 2) {
    setValue("insuredContracts", reference.defaultTexts.insuredContractsSingle);
    setValue("maximumConstructionPeriod", 12, {
      shouldDirty: true,
      shouldValidate: false,
    });
    setValue("subLimits", { ...reference.defaultSubLimits.annual });
  }
  if (coverTypeId === 3) {
    setValue("insuredContracts", reference.defaultTexts.insuredContractsSingle);
    setValue("maximumConstructionPeriod", 12, {
      shouldDirty: true,
      shouldValidate: false,
    });
    setValue("subLimits", { ...reference.defaultSubLimits.ownerBuilder });
  }
}
