import { useFormContext } from "react-hook-form";

import { FieldInput, Select } from "~/components/ui/form-controls";
import type { ReferenceData } from "~/lib/db/types";
import { SUB_LIMIT_FIELDS } from "~/lib/policies/sub-limits";
import { type CarPolicyFormValues } from "~/lib/zod/policy-car";

import { Section, SubLimitField } from "../section-shared";

export function Limits({ reference }: { reference: ReferenceData }) {
  const {
    formState: { errors },
  } = useFormContext<CarPolicyFormValues>();

  return (
    <div className="flex flex-col gap-8">
      <Section title="Section 1 – Contract Works">
        <div className="grid gap-4 md:grid-cols-2">
          <FieldInput
            label="Contract Works"
            required
            name="contractWorksSumInsured"
            type="text"
            inputMode="decimal"
            prefix="$"
            error={errors.contractWorksSumInsured?.message}
            tooltip="Limit any one Occurrence or Project Value $1- $5,000,000"
          />
          <FieldInput
            label="Display Homes"
            required
            name="displayHomes"
            type="text"
            inputMode="decimal"
            prefix="$"
            error={errors.displayHomes?.message}
          />
          <FieldInput
            label="Existing Structures"
            required
            name="existingStructure"
            type="text"
            inputMode="decimal"
            prefix="$"
            error={errors.existingStructure?.message}
            tooltip="Refer"
          />
          <FieldInput
            label="Named Insureds Construction Plant & Equipment"
            required
            name="plantEquipment"
            type="text"
            inputMode="decimal"
            prefix="$"
            error={errors.plantEquipment?.message}
            className="md:col-span-2"
          />
        </div>
      </Section>

      <Section title="Sub-limits of Liability">
        <div className="grid gap-4 md:grid-cols-2">
          {SUB_LIMIT_FIELDS.map((field) => (
            <SubLimitField key={field.key} field={field} />
          ))}
        </div>
      </Section>

      <Section title="Section 2 – Legal Liability">
        <Select
          name="liabilityLimitBand"
          label="Limit of Liability"
          required
          error={errors.liabilityLimitBand?.message}
          tooltip={
            <div className="flex flex-col gap-1">
              <p>Limit any one Occurrence $10,000,000 or $20,000,000</p>
              <p>
                Unlimited in the aggregate except in respect of Products
                Liability where the Limit is any one Occurrence and in the
                annual aggregate
              </p>
            </div>
          }
          options={[
            { value: "", label: "Please select..." },
            ...reference.liabilityLimitBands.map((item) => ({
              value: String(item.id),
              label: item.name,
            })),
          ]}
        />{" "}
      </Section>
    </div>
  );
}
