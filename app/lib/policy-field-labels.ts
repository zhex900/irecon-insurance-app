import { EXCESS_FIELDS } from "~/lib/excesses";
import { SUB_LIMIT_FIELDS } from "~/lib/sub-limits";

const TOP_LEVEL_LABELS: Record<string, string> = {
  insurerCode: "Insurer",
  insuredName: "Insured Name",
  coverTypeId: "Type of Cover",
  annualCoverTypeId: "Annual Type of Cover",
  policyCategoryId: "Policy Category",
  policyNumber: "Policy Number",
  siteAddress: "Site Address",
  postcode: "Postcode",
  stateId: "State",
  estimatedTurnover: "Estimated Turnover / Project Value",
  businessActivities: "Business Activities",
  insuredContracts: "Insured Contracts",
  geographicalScopes: "Geographical Scope",
  maximumConstructionPeriod: "Maximum Construction Period",
  maximumMaintenancePeriod: "Maximum Maintenance Period",
  dateStart: "Policy From Date",
  dateEnd: "Policy End Date",
  hasExistingContractWorksCover: "Current Contract Works/Liability policy",
  currentInsurer: "Current insurer",
  contractWorksSumInsured: "Contract Works",
  displayHomes: "Display Homes",
  existingStructure: "Existing Structures",
  plantEquipment: "Named Insureds Construction Plant & Equipment",
  liabilityLimitBand: "Limit of Liability",
  claimsCountLast3Years: "Number of claims last 3 years",
  anyClaimsExceed20k: "Claims exceeded $20,000",
  excludedContracts1: "Excluded contracts",
  excludedContracts2: "Excluded contracts (activities)",
  excludedContracts3: "Excluded contracts (definitions)",
  declarationConfirmed: "Duty of Disclosure",
  selectedWordingIds: "Additional Wording",
  customWordings: "Custom Wording",
  policyStatusId: "Policy status",
  excesses: "Excesses",
  subLimits: "Sub-limits",
  "excesses.excessAdditionalNotes": "Excess Additional Notes",
};

const EXCESS_LABELS = Object.fromEntries(
  EXCESS_FIELDS.map((field) => [`excesses.${field.key}`, field.label]),
);

const SUB_LIMIT_LABELS = Object.fromEntries(
  SUB_LIMIT_FIELDS.map((field) => [`subLimits.${field.key}`, field.label]),
);

function titleCasePath(path: string): string {
  const leaf = path.split(".").pop() ?? path;
  return leaf
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** Human label for a react-hook-form field path used in policy validation UI. */
export function labelForPolicyFieldPath(path: string): string {
  if (TOP_LEVEL_LABELS[path]) return TOP_LEVEL_LABELS[path];
  if (EXCESS_LABELS[path]) return EXCESS_LABELS[path];
  if (SUB_LIMIT_LABELS[path]) return SUB_LIMIT_LABELS[path];

  const root = path.split(".")[0] ?? path;
  if (TOP_LEVEL_LABELS[root] && path !== root) {
    return `${TOP_LEVEL_LABELS[root]} · ${titleCasePath(path)}`;
  }

  return titleCasePath(path);
}
