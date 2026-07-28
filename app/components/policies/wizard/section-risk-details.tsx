import { useFormContext } from "react-hook-form";
import {
  FieldInput,
  FieldTextarea,
  Select,
} from "~/components/ui/form-controls";
import { type CarPolicyFormValues } from "~/lib/zod/policy-car";
import type { ReferenceData } from "~/lib/db/types";
import { SiteAddressAutocomplete } from "~/components/forms/site-address-autocomplete";
import {
  applyAnnualCoverTypeDefaults,
  applyCoverTypeDefaults,
} from "./section-shared";

export function RiskDetailsStep({ reference }: { reference: ReferenceData }) {
  const {
    register,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useFormContext<CarPolicyFormValues>();

  const coverTypeId = Number(watch("coverTypeId"));
  const policyCategoryId = Number(watch("policyCategoryId"));
  const holdCurrent = watch("hasExistingContractWorksCover");
  const isRenewal = policyCategoryId === 2;
  const showCurrentInsurer = String(holdCurrent) === "true";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Select
        label="Insurer"
        required
        error={errors.insurerCode?.message}
        {...register("insurerCode")}
      >
        <option value="">Please select...</option>
        {reference.insurers.map((item) => (
          <option key={item.code} value={item.code}>
            {item.name}
          </option>
        ))}
      </Select>
      <FieldInput
        label="Insured Name"
        required
        error={errors.insuredName?.message}
        {...register("insuredName")}
      />
      <Select
        label="Type of Cover"
        required
        error={errors.coverTypeId?.message}
        tooltip="Please note that the sub limits will be refreshed when you change type of cover"
        {...register("coverTypeId", {
          onChange: (e) =>
            applyCoverTypeDefaults(
              Number(e.target.value),
              reference,
              setValue,
              getValues,
            ),
        })}
      >
        <option value="">Please select...</option>
        {reference.coverTypes.map((item) => (
          <option key={item.coverTypeId} value={item.coverTypeId}>
            {item.name}
          </option>
        ))}
      </Select>
      {coverTypeId === 1 ? (
        <Select
          label="Annual Type of Cover"
          required
          error={errors.annualCoverTypeId?.message}
          {...register("annualCoverTypeId", {
            onChange: (e) =>
              applyAnnualCoverTypeDefaults(
                Number(e.target.value),
                reference,
                setValue,
              ),
          })}
        >
          <option value="">Please select...</option>
          {reference.annualCoverTypes.map((item) => (
            <option key={item.annualCoverTypeId} value={item.annualCoverTypeId}>
              {item.name}
            </option>
          ))}
        </Select>
      ) : null}
      <Select
        label="Policy Category"
        required
        error={errors.policyCategoryId?.message}
        {...register("policyCategoryId")}
      >
        <option value="">Please select...</option>
        {reference.policyCategories.map((item) => (
          <option key={item.policyCategoryId} value={item.policyCategoryId}>
            {item.name}
          </option>
        ))}
      </Select>
      {isRenewal ? (
        <FieldInput
          label="Policy Number"
          required
          error={errors.policyNumber?.message}
          {...register("policyNumber")}
        />
      ) : null}
      <div className="rounded-lg border border-border bg-muted/20 p-4 md:col-span-2">
        <SiteAddressAutocomplete
          states={reference.states}
          syncGeographicalScope={coverTypeId === 2 || coverTypeId === 3}
        />
      </div>
      <FieldInput
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
          {...register("maximumConstructionPeriod")}
        />
        <FieldInput
          className="md:row-span-3 md:!grid md:grid-rows-subgrid md:gap-2"
          label="Maximum Maintenance Period (months)"
          required
          hint=""
          type="text"
          inputMode="decimal"
          error={errors.maximumMaintenancePeriod?.message}
          {...register("maximumMaintenancePeriod")}
        />
      </div>
      <div className="grid gap-x-4 gap-y-2 md:col-span-2 md:grid-cols-2 md:grid-rows-[auto_auto_auto]">
        <FieldInput
          className="md:row-span-3 md:!grid md:grid-rows-subgrid md:gap-2"
          label="Policy From Date"
          required
          hint="Auto 12 months for annual"
          type="date"
          error={errors.dateStart?.message}
          {...register("dateStart")}
        />
        <FieldInput
          className="md:row-span-3 md:!grid md:grid-rows-subgrid md:gap-2"
          label="Policy End Date"
          required
          hint={
            coverTypeId === 3
              ? "End Date for owner builder cannot exceed 12 months"
              : "End date for annual policy and single project cannot exceed 18 months from start date"
          }
          type="date"
          error={errors.dateEnd?.message}
          {...register("dateEnd")}
        />
      </div>
      <div className="md:col-span-2">
        <Select
          label="Do you hold a current Contract Works/Liability policy?"
          required
          error={errors.hasExistingContractWorksCover?.message}
          {...register("hasExistingContractWorksCover", {
            onChange: (event) => {
              if (event.target.value !== "true") {
                setValue("currentInsurer", "", {
                  shouldDirty: true,
                  shouldValidate: false,
                });
              }
            },
          })}
        >
          <option value="">Please select...</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </Select>
      </div>
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
