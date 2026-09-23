import type { CarSubLimits } from "~/lib/db/types";

export type SubLimitUnit = "percent" | "currency";

export type SubLimitFieldConfig = {
  key: keyof CarSubLimits;
  label: string;
  unit: SubLimitUnit;
  /** Used when migrating legacy bare-number values into free text. */
  defaultSuffix: string;
};

export const SUB_LIMIT_FIELDS: SubLimitFieldConfig[] = [
  {
    key: "removalOfDebris",
    label: "Removal of Debris",
    unit: "percent",
    defaultSuffix: "% of Contract Value",
  },
  {
    key: "expeditingExpenses",
    label: "Expediting Expenses",
    unit: "percent",
    defaultSuffix: "% of Contract Value",
  },
  {
    key: "professionalFees",
    label: "Professional Fees",
    unit: "percent",
    defaultSuffix: "% of Contract Value",
  },
  {
    key: "mitigationExpenses",
    label: "Mitigation Expenses",
    unit: "percent",
    defaultSuffix: "% of Contract Value",
  },
  {
    key: "searchAndLocateCosts",
    label: "Search and Locate Costs",
    unit: "currency",
    defaultSuffix: " any one loss",
  },
  {
    key: "plantHireCharges",
    label: "Plant Hire Charges",
    unit: "currency",
    defaultSuffix: " any one loss",
  },
  {
    key: "claimsPreparationCosts",
    label: "Claims Preparation Costs",
    unit: "currency",
    defaultSuffix: " any one loss",
  },
  {
    key: "governmentCosts",
    label: "Government Costs",
    unit: "currency",
    defaultSuffix: " any one loss",
  },
  {
    key: "inflationProtection",
    label: "Inflation Protection",
    unit: "percent",
    defaultSuffix: "% of Contract Value",
  },
  {
    key: "employeesProperty",
    label: "Employees Property",
    unit: "currency",
    defaultSuffix: " any one employee/any one loss",
  },
  {
    key: "materialsInOffSiteStorage",
    label: "Materials in Off-site Storage",
    unit: "currency",
    defaultSuffix: " any one loss",
  },
  {
    key: "transit",
    label: "Transit",
    unit: "currency",
    defaultSuffix: " any one loss",
  },
  {
    key: "additionalCostOfWorking",
    label: "Additional Cost of Working",
    unit: "currency",
    defaultSuffix: "",
  },
];

/** Keep free-text wording; expand legacy bare numbers into full wording. */
export function normalizeSubLimitValue(
  value: string | undefined,
  field?: SubLimitFieldConfig,
): string {
  if (value == null) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^not\s*insured$/i.test(trimmed)) return "Not Insured";
  // Already free text (contains letters, %, or $)
  if (/[a-zA-Z%$]/.test(trimmed)) return trimmed;
  const bare = trimmed.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(bare) || !field) return trimmed;
  if (Number(bare) === 0) return "Not Insured";
  if (field.unit === "percent") return `${bare}${field.defaultSuffix}`;
  const formatted = Number(bare).toLocaleString("en-AU");
  return `$${formatted}${field.defaultSuffix}`;
}

export function normalizeSubLimits(subLimits: CarSubLimits): CarSubLimits {
  return Object.fromEntries(
    SUB_LIMIT_FIELDS.map((field) => {
      let value = normalizeSubLimitValue(subLimits[field.key], field);
      if (field.key === "additionalCostOfWorking" && !value) {
        value = "Not Insured";
      }
      return [field.key, value];
    }),
  ) as CarSubLimits;
}
