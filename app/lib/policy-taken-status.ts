import type { PremiumBreakdown } from "~/lib/db/types";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

export type TakenPremiumKey =
  "contractWorksExistingStructurePremium" | "contractWorksPlantPremium";

export type TakenStatusIssue = {
  premiumKey: TakenPremiumKey;
  /** Short label for the Premium breakdown row */
  label: string;
  /** Full requirement message */
  message: string;
};

/**
 * Legacy Taken gate (CARViewPolicy Save): declared SI/cover requires a premium line.
 * @see `_archive/specs/CAR_SAVE_VALIDATION.md` § Taken status rule
 */
export function getTakenStatusIssues(
  values: Pick<CarPolicyFormValues, "existingStructure" | "plantEquipment">,
  premium: Pick<
    PremiumBreakdown,
    "contractWorksExistingStructurePremium" | "contractWorksPlantPremium"
  >,
): TakenStatusIssue[] {
  const issues: TakenStatusIssue[] = [];
  if (
    Number(values.existingStructure) > 0 &&
    Number(premium.contractWorksExistingStructurePremium ?? 0) === 0
  ) {
    issues.push({
      premiumKey: "contractWorksExistingStructurePremium",
      label: "Existing Structure premium",
      message:
        "Existing Structures is declared on Limits — enter an Existing Structure premium greater than $0 (or clear the Limits value).",
    });
  }
  if (
    Number(values.plantEquipment) > 25000 &&
    Number(premium.contractWorksPlantPremium ?? 0) === 0
  ) {
    issues.push({
      premiumKey: "contractWorksPlantPremium",
      label: "Plant and Equipment premium",
      message:
        "Plant and equipment is over $25,000 — enter or recalculate Plant premium greater than $0.",
    });
  }
  return issues;
}

export function getTakenStatusErrors(
  values: Pick<CarPolicyFormValues, "existingStructure" | "plantEquipment">,
  premium: Pick<
    PremiumBreakdown,
    "contractWorksExistingStructurePremium" | "contractWorksPlantPremium"
  >,
): string[] {
  return getTakenStatusIssues(values, premium).map((issue) => issue.message);
}

export function formatTakenStatusBlockMessage(errors: string[]): string {
  return `Unable to set status to taken. ${errors.join(" ")}`;
}
