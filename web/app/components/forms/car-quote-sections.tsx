import { useFormContext, Controller } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { FieldInput, FieldTextarea } from "~/components/ui/field";
import { Select } from "~/components/ui/select";
import type { CarQuoteFormValues } from "~/lib/zod/policy-car";
import type {
  CarWording,
  PremiumBreakdown,
  Quote,
  ReferenceData,
} from "~/lib/db/types";
import { formatCurrency } from "~/lib/utils";

export function PremiumSummaryPanel({
  premium,
  referralReasons,
  isCalculating,
}: {
  premium?: PremiumBreakdown;
  referralReasons?: string[];
  isCalculating?: boolean;
}) {
  return (
    <Card className="sticky top-4">
      <CardHeader>
        <CardTitle>Premium Summary</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {isCalculating ? (
          <p className="text-slate-500">Calculating premium…</p>
        ) : premium ? (
          <>
            <Row label="Section 1 total" value={premium.contractWorksTotalPremium} />
            <Row label="Section 2 total" value={premium.liabilityTotalPremium} />
            <Row label="Broker fees" value={premium.combinedBrokerFee} />
            <div className="border-t border-slate-200 pt-3 font-semibold">
              <Row
                label="Total premium"
                value={premium.originalTotalPremium}
                strong
              />
            </div>
          </>
        ) : (
          <p className="text-slate-500">
            Complete the form and calculate to see premium.
          </p>
        )}
        {referralReasons && referralReasons.length > 0 ? (
          <div className="rounded-md bg-amber-50 p-3 text-amber-900">
            <p className="font-medium">Referral reasons</p>
            <ul className="mt-2 list-disc pl-5">
              {referralReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={strong ? "font-semibold" : "text-slate-600"}>
        {label}
      </span>
      <span className={strong ? "font-semibold" : ""}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

export function RiskDetailsStep({ reference }: { reference: ReferenceData }) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<CarQuoteFormValues>();

  const coverTypeId = Number(watch("coverTypeId"));
  const businessTypeId = Number(watch("businessTypeId"));
  const holdCurrent = watch("hasExistingContractWorksCover");
  const isRenewal = businessTypeId === 2;
  const showCurrentInsurer =
    holdCurrent === true || String(holdCurrent) === "true";

  return (
    <Section title="Risk Details">
      <div className="grid gap-4 md:grid-cols-2">
        <Select
          label="Insurer"
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
          error={errors.insuredName?.message}
          {...register("insuredName")}
        />
        <Select
          label="Type of Cover"
          error={errors.coverTypeId?.message}
          {...register("coverTypeId", {
            onChange: (e) =>
              applyCoverTypeDefaults(
                Number(e.target.value),
                reference,
                setValue,
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
        <Select
          label="Business type"
          error={errors.businessTypeId?.message}
          {...register("businessTypeId")}
        >
          <option value="">Please select...</option>
          {reference.businessTypes.map((item) => (
            <option key={item.businessTypeId} value={item.businessTypeId}>
              {item.name}
            </option>
          ))}
        </Select>
        {isRenewal ? (
          <FieldInput
            label="Policy Number"
            error={errors.policyNumber?.message}
            {...register("policyNumber")}
          />
        ) : null}
        <FieldInput
          className="md:col-span-2"
          label="Site Address"
          error={errors.siteAddress?.message}
          {...register("siteAddress", {
            onChange: (e) => {
              if (coverTypeId === 2 || coverTypeId === 3) {
                setValue("geographicalScopes", e.target.value);
              }
            },
          })}
        />
        <FieldInput
          label="Estimated Turnover / Project Value"
          type="number"
          step="0.01"
          error={errors.estimatedTurnover?.message}
          {...register("estimatedTurnover")}
        />
        <FieldInput
          label="Postcode of Construction"
          error={errors.postcode?.message}
          {...register("postcode")}
        />
        <Select
          label="State of Construction"
          error={errors.stateId?.message}
          {...register("stateId")}
        >
          <option value="">Please select...</option>
          {reference.states.map((item) => (
            <option key={item.stateId} value={item.stateId}>
              {item.code}
            </option>
          ))}
        </Select>
        <FieldTextarea
          className="md:col-span-2"
          label="Business Activities"
          error={errors.businessActivities?.message}
          {...register("businessActivities")}
        />
        <FieldTextarea
          className="md:col-span-2"
          label="Insured Contracts"
          error={errors.insuredContracts?.message}
          {...register("insuredContracts")}
        />
        <FieldTextarea
          className="md:col-span-2"
          label="Geographical Scope"
          error={errors.geographicalScopes?.message}
          readOnly={coverTypeId === 2 || coverTypeId === 3}
          {...register("geographicalScopes")}
        />
        <FieldInput
          label="Maximum Construction Period (months)"
          type="number"
          error={errors.maximumConstructionPeriod?.message}
          {...register("maximumConstructionPeriod")}
        />
        <FieldInput
          label="Maximum Maintenance Period (months)"
          type="number"
          error={errors.maximumMaintenancePeriod?.message}
          {...register("maximumMaintenancePeriod")}
        />
        <FieldInput
          label="Policy Start Date"
          type="date"
          error={errors.dateStart?.message}
          {...register("dateStart")}
        />
        <FieldInput
          label="Policy End Date"
          type="date"
          error={errors.dateEnd?.message}
          {...register("dateEnd")}
        />
        <Select
          label="Do you hold a current Contract Works/Liability policy?"
          error={errors.hasExistingContractWorksCover?.message}
          {...register("hasExistingContractWorksCover")}
        >
          <option value="false">No</option>
          <option value="true">Yes</option>
        </Select>
        {showCurrentInsurer ? (
          <FieldInput
            label="Please advise name of current insurer"
            error={errors.currentInsurer?.message}
            {...register("currentInsurer")}
          />
        ) : null}
      </div>
    </Section>
  );
}

export function Section1Step() {
  const {
    register,
    formState: { errors },
  } = useFormContext<CarQuoteFormValues>();

  return (
    <div className="flex flex-col gap-8">
      <Section title="Section 1 - Contract Works">
        <div className="grid gap-4 md:grid-cols-2">
          <FieldInput
            label="Section 1 Contract Works"
            type="number"
            step="0.01"
            error={errors.contractWorksSumInsured?.message}
            {...register("contractWorksSumInsured")}
          />
          <FieldInput
            label="Display Homes"
            type="number"
            step="0.01"
            error={errors.displayHomes?.message}
            {...register("displayHomes")}
          />
          <FieldInput
            label="Existing Structures"
            type="number"
            step="0.01"
            error={errors.existingStructure?.message}
            {...register("existingStructure")}
          />
          <FieldInput
            label="Plant & Equipment"
            type="number"
            step="0.01"
            hint="Enter 0 if not required"
            error={errors.plantEquipment?.message}
            {...register("plantEquipment")}
          />
        </div>
      </Section>

      <Section title="Sub Limits">
        <div className="grid gap-4 md:grid-cols-2">
          {(
            [
              ["removalOfDebris", "Removal of Debris"],
              ["expeditingExpenses", "Expediting Expenses"],
              ["professionalFees", "Professional Fees"],
              ["mitigationExpenses", "Mitigation Expenses"],
              ["searchAndLocateCosts", "Search and Locate Costs"],
              ["plantHireCharges", "Plant Hire Charges"],
              ["claimsPreparationCosts", "Claims Preparation Costs"],
              ["governmentCosts", "Government Costs"],
              ["inflationProtection", "Inflation Protection"],
              ["employeesProperty", "Employees Property"],
              ["materialsInOffSiteStorage", "Materials in Off-site Storage"],
              ["transit", "Transit"],
            ] as const
          ).map(([key, label]) => (
            <FieldInput
              key={key}
              label={label}
              error={errors.subLimits?.[key]?.message}
              {...register(`subLimits.${key}`)}
            />
          ))}
        </div>
      </Section>
    </div>
  );
}

export function Section2ExcessesStep({
  reference,
}: {
  reference: ReferenceData;
}) {
  const {
    register,
    formState: { errors },
  } = useFormContext<CarQuoteFormValues>();

  return (
    <div className="flex flex-col gap-8">
      <Section title="Section 2 - Legal Liability">
        <Select
          label="Limit of Liability"
          error={errors.liabilityLimitBand?.message}
          {...register("liabilityLimitBand")}
        >
          <option value="">Please select...</option>
          {reference.liabilityLimitBands.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      </Section>

      <Section title="Excesses">
        <div className="grid gap-4 md:grid-cols-2">
          {(
            [
              [
                "excessSection1A",
                "Section 1A - Named Insured Plant & Equipment",
              ],
              ["excessSection1B", "Section 1B - Minor Perils up to $2M"],
              ["excessSection1E", "Section 1E - Major Perils up to $2M"],
              ["excessSection1C", "Section 1C - Minor Perils $2M-$5M"],
              ["excessSection1D", "Section 1D - Major Perils $2M-$5M"],
              ["excessSection2A", "Section 2A - Worker to Worker"],
              ["excessSection2C", "Section 2C - $10m Liability up to $2M"],
              ["excessSection2D", "Section 2D - $20m Liability up to $2M"],
              ["excessSection2E", "Section 2E - $10m Liability $2M-$5M"],
              ["excessSection2F", "Section 2F - $20m Liability $2M-$5M"],
            ] as const
          ).map(([key, label]) => (
            <FieldInput
              key={key}
              label={label}
              error={errors.excesses?.[key]?.message}
              {...register(`excesses.${key}`)}
            />
          ))}
          <FieldInput
            className="md:col-span-2"
            label="Excess Additional Notes"
            {...register("excesses.excessAdditionalNotes")}
          />
        </div>
      </Section>
    </div>
  );
}

export function ClaimsWordingStep({
  carWording,
}: {
  carWording: CarWording[];
}) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<CarQuoteFormValues>();

  return (
    <div className="flex flex-col gap-8">
      <Section title="Claims History">
        <div className="grid gap-4 md:grid-cols-2">
          <FieldInput
            label="Number of claims last 3 years"
            type="number"
            error={errors.claimsCountLast3Years?.message}
            {...register("claimsCountLast3Years")}
          />
          <Select
            label="Have any claims exceeded $20,000?"
            error={errors.anyClaimsExceed20k?.message}
            {...register("anyClaimsExceed20k")}
          >
            <option value="false">No</option>
            <option value="true">Yes</option>
          </Select>
        </div>
      </Section>

      <Section title="Excluded Contracts">
        <div className="flex flex-col gap-4">
          <FieldTextarea
            label="Excluded Contracts 1"
            {...register("excludedContracts1")}
          />
          <FieldTextarea
            label="Excluded Contracts 2"
            rows={8}
            {...register("excludedContracts2")}
          />
          <FieldTextarea
            label="Excluded Contracts 3"
            rows={5}
            {...register("excludedContracts3")}
          />
        </div>
      </Section>

      <Section title="General Disclosure">
        <Select
          label="Confirm duty of disclosure responses received"
          error={errors.declarationConfirmed?.message}
          {...register("declarationConfirmed")}
        >
          <option value="false">No</option>
          <option value="true">Yes</option>
        </Select>
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
                  <label className="flex items-start gap-3 rounded-md border border-slate-200 p-3">
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
                      <span className="font-medium">{item.subject}</span>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                        {item.content}
                      </p>
                    </span>
                  </label>
                );
              }}
            />
          ))}
          <label className="flex items-start gap-3 rounded-md border border-slate-200 p-3">
            <input
              type="checkbox"
              {...register("customWordingEnabled")}
              className="mt-1"
            />
            <div className="flex w-full flex-col gap-3">
              <FieldInput
                label="Custom Wording Subject"
                {...register("customWordingSubject")}
              />
              <FieldTextarea
                label="Custom Wording Content"
                rows={4}
                {...register("customWordingContent")}
              />
            </div>
          </label>
        </div>
      </Section>
    </div>
  );
}

export function ReviewStep({
  reference,
  premium,
  referralReasons,
}: {
  reference: ReferenceData;
  premium?: PremiumBreakdown;
  referralReasons: string[];
}) {
  const { watch } = useFormContext<CarQuoteFormValues>();
  const values = watch();

  const coverType = reference.coverTypes.find(
    (c) => c.coverTypeId === values.coverTypeId,
  )?.name;
  const state = reference.states.find(
    (s) => s.stateId === values.stateId,
  )?.code;
  const section2 = reference.liabilityLimitBands.find(
    (s) => s.id === values.liabilityLimitBand,
  )?.name;

  return (
    <div className="flex flex-col gap-6">
      <Section title="Review Quote Details">
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <ReviewField label="Insured" value={values.insuredName} />
          <ReviewField label="Cover type" value={coverType} />
          <ReviewField label="Site address" value={values.siteAddress} />
          <ReviewField
            label="State / Postcode of Construction"
            value={`${state ?? ""} ${values.postcode}`}
          />
          <ReviewField
            label="Turnover / project value"
            value={formatCurrency(values.estimatedTurnover)}
          />
          <ReviewField
            label="Policy period"
            value={`${values.dateStart} to ${values.dateEnd}`}
          />
          <ReviewField
            label="Section 1 value"
            value={formatCurrency(values.contractWorksSumInsured)}
          />
          <ReviewField label="Section 2 limit" value={section2} />
          <ReviewField
            label="Claims (3 years)"
            value={String(values.claimsCountLast3Years)}
          />
          <ReviewField
            label="Disclosure confirmed"
            value={values.declarationConfirmed ? "Yes" : "No"}
          />
        </dl>
      </Section>

      {premium ? (
        <Section title="Calculated Premium">
          <div className="flex flex-col gap-2 text-sm">
            <Row label="Section 1 total" value={premium.contractWorksTotalPremium} />
            <Row label="Section 2 total" value={premium.liabilityTotalPremium} />
            <Row
              label="Total premium"
              value={premium.originalTotalPremium}
              strong
            />
          </div>
        </Section>
      ) : null}

      {referralReasons.length > 0 ? (
        <div className="rounded-md bg-amber-50 p-4 text-amber-900">
          <p className="font-medium">Referral notes will be saved</p>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {referralReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function PricingDeclarationConfirmedStep({
  premium,
  referralReasons,
  reference,
  notes,
  canChangeStatus = false,
}: {
  premium?: PremiumBreakdown;
  referralReasons: string[];
  reference: ReferenceData;
  notes?: Quote["notes"];
  canChangeStatus?: boolean;
}) {
  const {
    register,
    formState: { errors },
  } = useFormContext<CarQuoteFormValues>();

  if (!premium) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-slate-500">
          Premium has not been calculated yet. Go back to Review and calculate
          premium.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {referralReasons.length > 0 ? (
        <div className="rounded-md bg-amber-50 p-4 text-amber-900">
          <p className="font-medium">Referral Reasons</p>
          <ul className="mt-2 list-disc pl-5">
            {referralReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {notes && notes.length > 0 ? (
        <div className="rounded-md border border-slate-200 p-4 text-sm">
          <p className="font-medium">Policy notes</p>
          {notes.map((note) => (
            <p
              key={note.policyNoteId}
              className="mt-2 whitespace-pre-wrap text-slate-600"
            >
              {note.description}
            </p>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>CAR Status</CardTitle>
        </CardHeader>
        <CardContent>
          {canChangeStatus ? (
            <fieldset className="flex flex-col gap-3">
              <legend className="sr-only">Change CAR Status</legend>
              <p className="text-sm text-slate-600">
                Change status from Pending to Taken or Not taken when saving.
              </p>
              <div className="flex flex-col gap-2">
                {reference.policyStatuses.map((status) => (
                  <label
                    key={status.policyStatusId}
                    className="flex items-center gap-2 text-sm text-slate-800"
                  >
                    <input
                      type="radio"
                      value={status.policyStatusId}
                      {...register("policyStatusId", { valueAsNumber: true })}
                    />
                    {status.name}
                  </label>
                ))}
              </div>
              {errors.policyStatusId?.message ? (
                <p className="text-sm text-red-600">{errors.policyStatusId.message}</p>
              ) : null}
            </fieldset>
          ) : (
            <p className="text-sm text-slate-600">
              Status can only be changed while the policy is Pending.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Premium Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="py-2 pr-4">Component</th>
                <th className="py-2 pr-4">Contract Works</th>
                <th className="py-2 pr-4">Legal Liability</th>
                <th className="py-2">Combined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <PremiumRow
                label="Base Premium"
                s1={premium.contractWorksCalculatedBasePremium}
                s2={premium.liabilityCalculatedBasePremium}
              />
              <PremiumRow
                label="True Base Premium"
                s1={premium.contractWorksBasePremium}
                s2={premium.liabilityBasePremium}
                combined={
                  premium.contractWorksBasePremium +
                  premium.liabilityBasePremium +
                  premium.contractWorksTerrorismPremium +
                  premium.contractWorksPlantPremium +
                  premium.contractWorksPlantTerrorismPremium +
                  (premium.contractWorksDisplayHomesPremium ?? 0) +
                  (premium.contractWorksExistingStructurePremium ?? 0)
                }
              />
              <PremiumRow
                label="Terrorism Levy"
                s1={premium.contractWorksTerrorismPremium}
              />
              <PremiumRow
                label="Display Homes"
                s1={premium.contractWorksDisplayHomesPremium ?? 0}
              />
              <PremiumRow
                label="Existing Structure"
                s1={premium.contractWorksExistingStructurePremium ?? 0}
              />
              <PremiumRow
                label="Plant and Equipment Over $25k"
                s1={premium.contractWorksPlantPremium}
              />
              <PremiumRow
                label="Terrorism Levy Plant and Equipment"
                s1={premium.contractWorksPlantTerrorismPremium}
              />
              <PremiumRow
                label="ESL Plant and Equipment"
                s1={premium.contractWorksPlantESL}
              />
              <PremiumRow
                label="ESL"
                s1={premium.contractWorksESL}
                s2={premium.liabilityESL}
                combined={
                  premium.contractWorksESL +
                  premium.liabilityESL +
                  premium.contractWorksPlantESL
                }
              />
              <PremiumRow
                label="GST"
                s1={premium.contractWorksGST}
                s2={premium.liabilityGST}
                combined={premium.contractWorksGST + premium.liabilityGST}
              />
              <PremiumRow
                label="Stamp Duty"
                s1={premium.contractWorksStampDuty}
                s2={premium.liabilityStampDuty}
                combined={premium.contractWorksStampDuty + premium.liabilityStampDuty}
              />
              {reference.feeNames.map((fee) => (
                <tr key={fee.name}>
                  <td className="py-2 pr-4">{fee.name}</td>
                  <td className="py-2 pr-4" colSpan={2} />
                  <td className="py-2">
                    {formatCurrency(fee.fee + fee.feeGst)}
                  </td>
                </tr>
              ))}
              <PremiumRow
                label="Total Premium"
                s1={premium.contractWorksTotalPremium}
                s2={premium.liabilityTotalPremium}
                combined={premium.originalTotalPremium}
                strong
              />
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function PremiumRow({
  label,
  s1,
  s2,
  combined,
  strong,
}: {
  label: string;
  s1?: number;
  s2?: number;
  combined?: number;
  strong?: boolean;
}) {
  return (
    <tr className={strong ? "font-semibold" : undefined}>
      <td className="py-2 pr-4">{label}</td>
      <td className="py-2 pr-4">{s1 != null ? formatCurrency(s1) : ""}</td>
      <td className="py-2 pr-4">{s2 != null ? formatCurrency(s2) : ""}</td>
      <td className="py-2">
        {combined != null ? formatCurrency(combined) : ""}
      </td>
    </tr>
  );
}

function ReviewField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function applyCoverTypeDefaults(
  coverTypeId: number,
  reference: ReferenceData,
  setValue: ReturnType<typeof useFormContext<CarQuoteFormValues>>["setValue"],
) {
  if (coverTypeId === 1) {
    setValue("insuredContracts", reference.defaultTexts.insuredContractsAnnual);
    setValue(
      "geographicalScopes",
      reference.defaultTexts.geographicalScopeAnnual,
    );
    setValue("subLimits", { ...reference.defaultSubLimits.annual });
  }
  if (coverTypeId === 2) {
    setValue("insuredContracts", reference.defaultTexts.insuredContractsSingle);
    setValue("subLimits", { ...reference.defaultSubLimits.annual });
  }
  if (coverTypeId === 3) {
    setValue("insuredContracts", reference.defaultTexts.insuredContractsSingle);
    setValue("subLimits", { ...reference.defaultSubLimits.ownerBuilder });
  }
}

/** @deprecated Use step-specific components */
export function CarQuoteStepOne({
  reference,
  carWording,
}: {
  reference: ReferenceData;
  carWording: CarWording[];
}) {
  return (
    <div className="flex flex-col gap-8">
      <RiskDetailsStep reference={reference} />
      <Section1Step />
      <Section2ExcessesStep reference={reference} />
      <ClaimsWordingStep carWording={carWording} />
    </div>
  );
}
