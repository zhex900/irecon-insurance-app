import { useFormContext } from "react-hook-form";

import { PolicyNumberField } from "~/components/policies/policy-number-field";
import { SiteAddressAutocomplete } from "~/components/policies/wizard/site-address-autocomplete";
import {
  FieldDateInput,
  FieldInput,
  FieldTextarea,
  Select,
} from "~/components/ui/form-controls";
import type { ReferenceData } from "~/lib/db/types";
import { syncExcludedContractsPeriodsFromForm } from "~/lib/policies/excluded-contracts";
import { derivePolicyEndDate } from "~/lib/policies/policy-period";
import { isIsoDate } from "~/lib/search/date-range-filter";
import { type CarPolicyFormValues } from "~/lib/zod/policy-car";

import {
  applyAnnualCoverTypeDefaults,
  applyCoverTypeDefaults,
} from "../section-shared";

export function RiskDetails({ reference }: { reference: ReferenceData }) {
  const {
    register,
    watch,
    setValue,
    getValues,
    clearErrors,
    formState: { errors },
  } = useFormContext<CarPolicyFormValues>();

  const coverTypeId = Number(watch("coverTypeId"));
  const policyCategoryId = Number(watch("policyCategoryId"));
  const policyNumber = watch("policyNumber") ?? "";
  const holdCurrent = watch("hasExistingContractWorksCover");
  const isRenewal = policyCategoryId === 2;
  const showCurrentInsurer = String(holdCurrent) === "true";
  const maximumConstructionPeriodRegister = register(
    "maximumConstructionPeriod",
  );
  const maximumMaintenancePeriodRegister = register("maximumMaintenancePeriod");

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Select
        name="insurerCode"
        label="Insurer"
        required
        error={errors.insurerCode?.message}
        options={[
          { value: "", label: "Please select..." },
          ...reference.insurers.map((item) => ({
            value: item.code,
            label: item.name,
          })),
        ]}
      />
      <FieldInput
        label="Insured Name"
        required
        error={errors.insuredName?.message}
        {...register("insuredName")}
      />
      <Select
        name="coverTypeId"
        label="Type of Cover"
        required
        error={errors.coverTypeId?.message}
        tooltip="Please note that the sub limits and documents will be refreshed when you change type of cover"
        options={[
          { value: "", label: "Please select..." },
          ...reference.coverTypes.map((item) => ({
            value: String(item.coverTypeId),
            label: item.name,
          })),
        ]}
        onValueChange={(next) =>
          applyCoverTypeDefaults(Number(next), reference, setValue, getValues)
        }
      />
      {coverTypeId === 1 ? (
        <Select
          name="annualCoverTypeId"
          label="Annual Type of Cover"
          required
          error={errors.annualCoverTypeId?.message}
          options={[
            { value: "", label: "Please select..." },
            ...reference.annualCoverTypes.map((item) => ({
              value: String(item.annualCoverTypeId),
              label: item.name,
            })),
          ]}
          onValueChange={(next) =>
            applyAnnualCoverTypeDefaults(
              Number(next),
              reference,
              setValue,
              getValues,
            )
          }
        />
      ) : null}
      <Select
        name="policyCategoryId"
        label="Policy Category"
        required
        error={errors.policyCategoryId?.message}
        options={[
          { value: "", label: "Please select..." },
          ...reference.policyCategories.map((item) => ({
            value: String(item.policyCategoryId),
            label: item.name,
          })),
        ]}
      />{" "}
      {isRenewal ? (
        <PolicyNumberField
          value={policyNumber}
          required
          error={errors.policyNumber?.message}
          onChange={(next) => {
            clearErrors("policyNumber");
            setValue("policyNumber", next, {
              shouldDirty: true,
              shouldValidate: false,
            });
          }}
        />
      ) : null}
      <div className="rounded-lg border border-border bg-muted/20 p-4 md:col-span-2">
        <SiteAddressAutocomplete
          states={reference.states}
          syncGeographicalScope={coverTypeId === 2 || coverTypeId === 3}
        />
      </div>
      <FieldInput
        className="md:col-span-2"
        label="Estimated Turnover / Project Value"
        required
        name="estimatedTurnover"
        type="text"
        inputMode="decimal"
        prefix="$"
        error={errors.estimatedTurnover?.message}
        tooltip={
          <div className="flex flex-col gap-1">
            <p>Annual: Turnover up to maximum $20,000,000</p>
            <p>Single: Project Value up to maximum $5,000,000</p>
            <p>Owner Builder: Project Value up to maximum $1,000,000</p>
          </div>
        }
      />
      <FieldTextarea
        className="md:col-span-2"
        label="Business Activities"
        required
        error={errors.businessActivities?.message}
        {...register("businessActivities")}
      />
      <FieldTextarea
        className="md:col-span-2"
        label="Insured Contracts"
        required
        error={errors.insuredContracts?.message}
        {...register("insuredContracts")}
      />
      <FieldTextarea
        className="md:col-span-2"
        label="Geographical Scope"
        hint="Anywhere in Australia below the 26th parallel south"
        error={errors.geographicalScopes?.message}
        readOnly={coverTypeId === 2 || coverTypeId === 3}
        tooltip="Geographical Scope for single project is the site address. Editable for other cover type"
        {...register("geographicalScopes")}
      />
      <div className="grid gap-x-4 gap-y-2 md:col-span-2 md:grid-cols-2 md:grid-rows-[auto_auto_auto]">
        <FieldInput
          className="md:row-span-3 md:!grid md:grid-rows-subgrid md:gap-2"
          label="Maximum Construction Period (months)"
          required
          hint="Annual policy is 18 months and single policy is 12 months"
          type="text"
          inputMode="decimal"
          error={errors.maximumConstructionPeriod?.message}
          {...maximumConstructionPeriodRegister}
          onBlur={(event) => {
            void maximumConstructionPeriodRegister.onBlur(event);
            syncExcludedContractsPeriodsFromForm(getValues, setValue);
          }}
        />
        <FieldInput
          className="md:row-span-3 md:!grid md:grid-rows-subgrid md:gap-2"
          label="Maximum Maintenance Period (months)"
          required
          hint=""
          type="text"
          inputMode="decimal"
          error={errors.maximumMaintenancePeriod?.message}
          {...maximumMaintenancePeriodRegister}
          onBlur={(event) => {
            void maximumMaintenancePeriodRegister.onBlur(event);
            syncExcludedContractsPeriodsFromForm(getValues, setValue);
          }}
        />
      </div>
      <div className="grid gap-x-4 gap-y-2 md:col-span-2 md:grid-cols-2 md:grid-rows-[auto_auto_auto]">
        <FieldDateInput
          className="md:row-span-3 md:!grid md:grid-rows-subgrid md:gap-2"
          name="dateStart"
          label="Policy From Date"
          required
          hint="Policy end date auto-fills 12 months from this date"
          error={errors.dateStart?.message}
          onChange={(next) => {
            if (!isIsoDate(next)) return;
            const dateEnd = derivePolicyEndDate(next);
            if (!dateEnd) return;
            setValue("dateEnd", dateEnd, {
              shouldDirty: true,
              shouldValidate: false,
            });
          }}
        />
        <FieldDateInput
          className="md:row-span-3 md:!grid md:grid-rows-subgrid md:gap-2"
          name="dateEnd"
          label="Policy End Date"
          required
          hint={
            coverTypeId === 3
              ? "End Date for owner builder cannot exceed 12 months"
              : "End date for annual policy and single project cannot exceed 18 months from start date"
          }
          error={errors.dateEnd?.message}
        />
      </div>
      <div className="md:col-span-2">
        <Select
          name="hasExistingContractWorksCover"
          label="Do you hold a current contract works/liability policy?"
          required
          error={errors.hasExistingContractWorksCover?.message}
          options={[
            { value: "", label: "Please select..." },
            { value: "true", label: "Yes" },
            { value: "false", label: "No" },
          ]}
          onValueChange={(next) => {
            if (next !== "true") {
              setValue("currentInsurer", "", {
                shouldDirty: true,
                shouldValidate: false,
              });
            }
          }}
        />
      </div>{" "}
      {showCurrentInsurer ? (
        <FieldInput
          className="md:col-span-2"
          label="Please advise name of current insurer"
          required
          error={errors.currentInsurer?.message}
          {...register("currentInsurer")}
        />
      ) : null}
    </div>
  );
}
