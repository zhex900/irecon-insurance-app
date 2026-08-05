import { EXCESS_FIELDS } from "~/lib/policies/excesses";
import { SUB_LIMIT_FIELDS } from "~/lib/policies/sub-limits";
import { wizardStepFields, wizardSteps } from "~/lib/zod/policy-car";

/** Keep in sync with POLICY_FORM_SECTIONS order in policy-form-layout. */
const SECTION_ID_BY_STEP = [
  "risk-details",
  "limits-of-liability",
  "excesses",
  "claims",
  "premium",
] as const;

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

/** Extra visible form copy (group titles, descriptions, premium labels). */
const FORM_LABEL_EXTRAS: Array<{
  sectionId: string;
  label: string;
  searchText?: string;
}> = [
  {
    sectionId: "policy-information",
    label: "Policy Information",
    searchText: "policy information notes",
  },
  {
    sectionId: "risk-details",
    label: "Risk Details",
    searchText: "cover type site dates insured contracts",
  },
  {
    sectionId: "limits-of-liability",
    label: "Limits of Liability",
    searchText: "contract works sums sub-limits legal liability",
  },
  {
    sectionId: "limits-of-liability",
    label: "Section 1 – Contract Works",
    searchText: "contract works display homes existing structures plant",
  },
  {
    sectionId: "limits-of-liability",
    label: "Sub-limits of Liability",
    searchText: "sub-limits of liability",
  },
  {
    sectionId: "limits-of-liability",
    label: "Section 2 – Legal Liability",
    searchText: "limit any one Occurrence",
  },
  {
    sectionId: "excesses",
    label: "Excesses",
    searchText: "contract works and legal liability excesses",
  },
  {
    sectionId: "excesses",
    label: "Section 1 – Contract Works Excesses",
    searchText: "minor perils major perils plant equipment",
  },
  {
    sectionId: "excesses",
    label: "Section 2 – Legal Liability Excesses",
    searchText: "worker to worker",
  },
  {
    sectionId: "claims",
    label: "Claims",
    searchText: "claims history exclusions declaration wording",
  },
  {
    sectionId: "claims",
    label: "Claims History",
  },
  {
    sectionId: "claims",
    label: "Excluded Contracts",
  },
  {
    sectionId: "claims",
    label: "Premium Adjustment",
  },
  {
    sectionId: "claims",
    label: "General Disclosure",
    searchText: "duty of disclosure declaration confirmed",
  },
  {
    sectionId: "claims",
    label: "Additional Wording",
    searchText: "custom wording selected wording",
  },
  {
    sectionId: "premium",
    label: "Premium",
    searchText: "status premium breakdown confirmation",
  },
  {
    sectionId: "premium",
    label: "Premium Summary",
  },
  {
    sectionId: "premium",
    label: "Policy Status",
    searchText: "taken not taken pending",
  },
  {
    sectionId: "premium",
    label: "Premium Breakdown",
    searchText:
      "base premium true base terrorism levy ESL GST stamp duty total premium broker fees",
  },
  {
    sectionId: "premium",
    label: "Base Premium",
  },
  {
    sectionId: "premium",
    label: "True Base Premium",
  },
  {
    sectionId: "premium",
    label: "Terrorism Levy",
  },
  {
    sectionId: "premium",
    label: "ESL",
  },
  {
    sectionId: "premium",
    label: "GST",
  },
  {
    sectionId: "premium",
    label: "Stamp Duty",
  },
  {
    sectionId: "premium",
    label: "Total Premium",
  },
  {
    sectionId: "premium",
    label: "Broker fees",
  },
];

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

export type PolicyFieldSearchOption = {
  /**
   * Jump target:
   * - field path (e.g. `siteAddress`)
   * - section marker (`#risk-details`)
   */
  value: string;
  label: string;
  /** Section name shown as secondary text */
  secondary: string;
  searchText: string;
  sectionId: string;
};

const SECTION_LABELS: Record<string, string> = {
  "policy-information": "Policy Information",
  "risk-details": "Risk Details",
  "limits-of-liability": "Limits of Liability",
  excesses: "Excesses",
  claims: "Claims",
  premium: "Premium",
};

/**
 * Flat catalogue for the wizard side-nav search.
 * Includes sections, group headings, and individual field labels.
 */
export function listPolicyFieldSearchOptions(): PolicyFieldSearchOption[] {
  const options: PolicyFieldSearchOption[] = [];
  const seen = new Set<string>();

  function push(option: PolicyFieldSearchOption) {
    const key = `${option.value}::${option.label}`;
    if (seen.has(key)) return;
    seen.add(key);
    options.push(option);
  }

  // Sections first (nav labels + descriptions from wizardSteps).
  for (const [sectionId, label] of Object.entries(SECTION_LABELS)) {
    const stepIndex = SECTION_ID_BY_STEP.indexOf(
      sectionId as (typeof SECTION_ID_BY_STEP)[number],
    );
    const stepLabel = stepIndex >= 0 ? wizardSteps[stepIndex] : label;
    push({
      value: `#${sectionId}`,
      label,
      secondary: "Section",
      searchText: [label, stepLabel, "section"].filter(Boolean).join(" "),
      sectionId,
    });
  }

  // Visible group titles / other form copy → jump to containing section.
  for (const extra of FORM_LABEL_EXTRAS) {
    push({
      value: `#${extra.sectionId}`,
      label: extra.label,
      secondary: SECTION_LABELS[extra.sectionId] ?? extra.sectionId,
      searchText: [
        extra.label,
        extra.searchText,
        SECTION_LABELS[extra.sectionId],
      ]
        .filter(Boolean)
        .join(" "),
      sectionId: extra.sectionId,
    });
  }

  for (const [stepKey, fields] of Object.entries(wizardStepFields)) {
    const stepIndex = Number(stepKey);
    const sectionId = SECTION_ID_BY_STEP[stepIndex] ?? "risk-details";
    const sectionLabel = wizardSteps[stepIndex] ?? sectionId;

    for (const field of fields) {
      const root = String(field);

      if (root === "excesses") {
        for (const excess of EXCESS_FIELDS) {
          const path = `excesses.${excess.key}`;
          const label = labelForPolicyFieldPath(path);
          push({
            value: path,
            label,
            secondary: sectionLabel,
            searchText: [
              label,
              excess.description,
              excess.band,
              excess.group,
              sectionLabel,
            ]
              .filter(Boolean)
              .join(" "),
            sectionId,
          });
        }
        const notesPath = "excesses.excessAdditionalNotes";
        push({
          value: notesPath,
          label: labelForPolicyFieldPath(notesPath),
          secondary: sectionLabel,
          searchText: `${labelForPolicyFieldPath(notesPath)} ${sectionLabel}`,
          sectionId,
        });
        continue;
      }

      if (root === "subLimits") {
        for (const sub of SUB_LIMIT_FIELDS) {
          const path = `subLimits.${sub.key}`;
          const label = labelForPolicyFieldPath(path);
          push({
            value: path,
            label,
            secondary: sectionLabel,
            searchText: `${label} ${sub.defaultSuffix} ${sectionLabel}`,
            sectionId,
          });
        }
        continue;
      }

      const label = labelForPolicyFieldPath(root);
      push({
        value: root,
        label,
        secondary: sectionLabel,
        searchText: `${label} ${sectionLabel} ${root}`,
        sectionId,
      });
    }
  }

  return options;
}
