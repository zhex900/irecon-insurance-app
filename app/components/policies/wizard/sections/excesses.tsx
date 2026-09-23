import { useFormContext } from "react-hook-form";

import { FieldInput } from "~/components/ui/form-controls";
import type { ReferenceData } from "~/lib/db/types";
import {
  groupExcessFieldsByBand,
  isLegalLiabilityInsured,
  resolveContractValueBand,
  visibleExcessFields,
} from "~/lib/policies/excesses";
import { type CarPolicyFormValues } from "~/lib/zod/policy-car";

import { ExcessField, Section } from "../section-shared";

export function Excesses({ reference }: { reference: ReferenceData }) {
  const { register, watch } = useFormContext<CarPolicyFormValues>();
  const contractWorksSumInsured = watch("contractWorksSumInsured");
  const liabilityLimitBand = watch("liabilityLimitBand");
  const legalLiabilityExcessBand = resolveContractValueBand(
    contractWorksSumInsured,
  );
  const legalLiabilityInsured = isLegalLiabilityInsured(liabilityLimitBand);

  const contractWorksBands = groupExcessFieldsByBand(
    visibleExcessFields({
      contractWorksSumInsured,
      liabilityLimitBand,
      group: "contractWorks",
    }),
  );
  const legalLiabilityBands = groupExcessFieldsByBand(
    visibleExcessFields({
      contractWorksSumInsured,
      liabilityLimitBand,
      group: "legalLiability",
    }),
  );

  const plantEquipmentDefaultExcess =
    reference.defaultExcesses.excessPlantEquipment;

  return (
    <div className="flex flex-col gap-8">
      <Section title="Section 1 – Contract Works Excesses">
        <div className="flex flex-col gap-6">
          <ExcessBandGroups
            bands={contractWorksBands}
            plantEquipmentDefaultExcess={plantEquipmentDefaultExcess}
          />
          <FieldInput
            label="Excess Additional Notes"
            {...register("excesses.excessAdditionalNotes")}
          />
        </div>
      </Section>

      <Section title="Section 2 – Legal Liability Excesses">
        <div className="flex flex-col gap-6">
          {!legalLiabilityInsured ? (
            <p className="text-sm text-muted-foreground">Not Applicable</p>
          ) : (
            <>
              <ExcessBandGroups bands={legalLiabilityBands} />
              {!legalLiabilityExcessBand ? (
                <p className="text-sm text-muted-foreground">
                  Enter Contract Works under Limits of Liability to show the
                  matching Limit of Liability excess for that contract value
                  band.
                </p>
              ) : null}
              <FieldInput
                label="Excess Additional Notes"
                {...register("excesses.excessLegalLiabilityAdditionalNotes")}
              />
            </>
          )}
        </div>
      </Section>
    </div>
  );
}

function ExcessBandGroups({
  bands,
  plantEquipmentDefaultExcess,
}: {
  bands: ReturnType<typeof groupExcessFieldsByBand>;
  plantEquipmentDefaultExcess?: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      {bands.map((group) => (
        <div
          key={group.band ?? group.fields[0]?.key}
          className="flex flex-col gap-3"
        >
          <div className="grid gap-4 md:grid-cols-2">
            {group.fields.map((field) => (
              <ExcessField
                key={field.key}
                field={field}
                plantEquipmentDefaultExcess={plantEquipmentDefaultExcess}
                className={
                  field.key === "excessPlantEquipment"
                    ? "md:col-span-2"
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
