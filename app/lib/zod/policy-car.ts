import { z } from "zod";

import { type AmountFieldValue, stripAmountCommas } from "~/lib/amount-input";
import { visibleExcessFields } from "~/lib/policies/excesses";
import {
  addCalendarMonths,
  parseLocalIsoDate,
} from "~/lib/policies/policy-period";

/** Free-text sub-limit wording (legacy varchar(100)). */
const subLimitText = z
  .string()
  .trim()
  .min(1, "Required")
  .max(100, "Must be 100 characters or fewer");

/** General text field with reasonable limits */
const standardTextField = z
  .string()
  .trim()
  .max(500, "Must be 500 characters or fewer");

/** Long text field for notes/descriptions */
const _longTextField = z
  .string()
  .trim()
  .max(2000, "Must be 2000 characters or fewer");

/** URL-safe field */
const urlSafeField = z
  .string()
  .trim()
  .max(200, "Must be 200 characters or fewer")
  .regex(/^[a-zA-Z0-9\-_.\s]*$/, "Contains invalid characters");

/** Required money: empty is invalid (do not coerce "" → 0). */
const moneyNumber = z.preprocess(
  (val) => {
    const stripped = stripAmountCommas(val);
    if (stripped === "" || stripped == null) return undefined;
    return stripped;
  },
  z.coerce.number({ error: "Required" }).min(0, "Must be 0 or greater"),
);

const moneyNumberPositive = z.preprocess(
  stripAmountCommas,
  z.coerce.number().positive("Estimated turnover must be greater than 0"),
);

const moneyNumberOptional = z.preprocess((val) => {
  const stripped = stripAmountCommas(val);
  if (stripped === "" || stripped == null) return undefined;
  return stripped;
}, z.coerce.number().min(0).optional());

const subLimitsSchema = z.object({
  removalOfDebris: subLimitText,
  expeditingExpenses: subLimitText,
  professionalFees: subLimitText,
  mitigationExpenses: subLimitText,
  searchAndLocateCosts: subLimitText,
  plantHireCharges: subLimitText,
  claimsPreparationCosts: subLimitText,
  governmentCosts: subLimitText,
  inflationProtection: subLimitText,
  employeesProperty: subLimitText,
  materialsInOffSiteStorage: subLimitText,
  transit: subLimitText,
  additionalCostOfWorking: subLimitText,
});

const excessNumber = z.preprocess(
  (val) => {
    const stripped = stripAmountCommas(val);
    if (stripped === "" || stripped == null) return "";
    return stripped;
  },
  z
    .string()
    .regex(/^(?:\d+(?:\.\d+)?|N\/A)?$/i, "Enter a numeric excess or N/A"),
);

const excessesSchema = z.object({
  excessPlantEquipment: excessNumber,
  excessUpTo2MMinorPerils: excessNumber,
  excessUpTo2MMajorPerils: excessNumber,
  excessOver2MMinorPerils: excessNumber,
  excessOver2MMajorPerils: excessNumber,
  excessAdditionalNotes: z.string().optional(),
  excessLegalLiabilityAdditionalNotes: z.string().optional(),
  excessWorkerToWorker: excessNumber,
  excessUpTo2MLimit10M: excessNumber,
  excessUpTo2MLimit20M: excessNumber,
  excessOver2MLimit10M: excessNumber,
  excessOver2MLimit20M: excessNumber,
});

/** Policy status IDs from reference data (Pending / Taken / Not taken) */
export const POLICY_STATUS = {
  Pending: 1,
  Taken: 2,
  NotTaken: 3,
} as const;

/** Taken / Not taken — safe to import from client components (no DB deps). */
export function isTerminalStatus(policyStatusId: number) {
  return (
    policyStatusId === POLICY_STATUS.Taken ||
    policyStatusId === POLICY_STATUS.NotTaken
  );
}

const baseFields = {
  clientId: z.string().uuid(),
  policyStatusId: z.coerce
    .number()
    .int()
    .min(1, "'Status' is required")
    .max(3, "'Status' is required"),
  insurerCode: urlSafeField.min(1, "Insurer is required"),
  insuredName: standardTextField.min(1, "Insured name is required"),
  coverTypeId: z.coerce.number().min(1, "Type of cover is required"),
  /** Required when cover type is Annual; cleared for Single / Owner Builder. */
  annualCoverTypeId: z.coerce.number().optional().nullable(),
  policyCategoryId: z.coerce.number().min(1, "Policy category is required"),
  policyNumber: urlSafeField.optional(),
  siteAddress: standardTextField.optional().default(""),
  estimatedTurnover: moneyNumberPositive,
  postcode: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Postcode is required"),
  stateId: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return undefined;
      return val;
    },
    z.coerce.number().min(1, "State is required"),
  ),
  businessActivities: standardTextField.min(
    1,
    "Business activities is required",
  ),
  insuredContracts: standardTextField.min(1, "Insured contracts is required"),
  geographicalScopes: standardTextField.optional().default(""),
  maximumConstructionPeriod: z.coerce.number().int().positive(),
  maximumMaintenancePeriod: z.coerce.number().int().positive(),
  dateStart: z.string().min(1, "Policy from date is required"),
  dateEnd: z.string().min(1, "Policy end date is required"),
  hasExistingContractWorksCover: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return undefined;
      if (val === true || val === "true") return true;
      if (val === false || val === "false") return false;
      return val;
    },
    z.boolean({
      error:
        "Please answer whether you hold a current Contract Works/Liability policy",
    }),
  ),
  currentInsurer: z.string().optional(),
  contractWorksSumInsured: moneyNumber,
  displayHomes: moneyNumber,
  existingStructure: moneyNumber,
  section1DisplayHomes: z.coerce.number().min(0),
  section1ExistingStructure: z.coerce.number().min(0),
  plantEquipment: moneyNumber,
  liabilityLimitBand: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    return val;
  }, z.coerce.number().min(1)),
  claimsCountLast3Years: z.preprocess(
    (val) => {
      const stripped = stripAmountCommas(val);
      if (stripped === "" || stripped == null) return undefined;
      return stripped;
    },
    z.coerce.number({ error: "Required" }).int().min(0),
  ),
  anyClaimsExceed20k: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return undefined;
      if (val === true || val === "true") return true;
      if (val === false || val === "false") return false;
      return val;
    },
    z.boolean({
      error: "Please select whether any claims exceeded $20,000",
    }),
  ),
  declarationConfirmed: z.coerce.boolean(),
  subLimits: subLimitsSchema,
  excesses: excessesSchema,
  excludedContracts1: z.string().optional().default(""),
  excludedContracts2: z.string().optional().default(""),
  excludedContracts3: z.string().optional().default(""),
  selectedWordingIds: z.array(z.coerce.number()).default([]),
  customWordings: z
    .array(
      z.object({
        id: z.string(),
        subject: z.string(),
        content: z.string(),
      }),
    )
    .default([]),
};

type PolicyRuleFields = {
  policyCategoryId?: number;
  policyNumber?: string;
  hasExistingContractWorksCover?: boolean;
  currentInsurer?: string;
  coverTypeId?: number;
  annualCoverTypeId?: number | null;
  dateStart?: string;
  dateEnd?: string;
};

function parseIsoDate(isoDate: string): Date | null {
  return parseLocalIsoDate(isoDate);
}

function pushCustomIssue(
  issues: { path: (string | number)[]; message: string }[],
  path: (string | number)[],
  message: string,
) {
  issues.push({ path, message });
}

/** Cross-field rules used by Zod and the wizard incomplete list. */
export function getPolicyRuleIssues(
  data: PolicyRuleFields & {
    estimatedTurnover?: AmountFieldValue;
    contractWorksSumInsured?: AmountFieldValue;
    liabilityLimitBand?: AmountFieldValue;
    excesses?: Record<string, string | undefined>;
  },
): { path: (string | number)[]; message: string }[] {
  const issues: { path: (string | number)[]; message: string }[] = [];

  if (data.policyCategoryId === 2 && !data.policyNumber?.trim()) {
    pushCustomIssue(
      issues,
      ["policyNumber"],
      "Policy number is required for renewal",
    );
  }
  if (
    data.hasExistingContractWorksCover === true &&
    !data.currentInsurer?.trim()
  ) {
    pushCustomIssue(issues, ["currentInsurer"], "Current insurer is required");
  }
  if (data.coverTypeId === 1) {
    const annualType = Number(data.annualCoverTypeId);
    if (annualType !== 1 && annualType !== 2) {
      pushCustomIssue(
        issues,
        ["annualCoverTypeId"],
        "Annual type of cover is required",
      );
    }
  }
  if (data.dateStart && data.dateEnd) {
    const end = parseIsoDate(data.dateEnd);
    if (data.coverTypeId === 1 || data.coverTypeId === 2) {
      const maxEnd = addCalendarMonths(data.dateStart, 18);
      if (end && maxEnd && end > maxEnd) {
        pushCustomIssue(
          issues,
          ["dateEnd"],
          "End date for annual policy and single project cannot exceed 18 months from Start Date",
        );
      }
    }
    if (data.coverTypeId === 3) {
      const maxEnd = addCalendarMonths(data.dateStart, 12);
      if (end && maxEnd && end > maxEnd) {
        pushCustomIssue(
          issues,
          ["dateEnd"],
          "End Date for Owner Builder cannot exceed 12 months",
        );
      }
    }
  }

  if (data.excesses) {
    const visible = visibleExcessFields({
      contractWorksSumInsured: data.contractWorksSumInsured,
      liabilityLimitBand: data.liabilityLimitBand,
    });
    for (const field of visible) {
      const raw = String(data.excesses[field.key] ?? "")
        .replace(/,/g, "")
        .trim();
      if (!raw) {
        pushCustomIssue(issues, ["excesses", field.key], "Required");
      } else if (!/^(?:\d+(\.\d+)?|N\/A)$/i.test(raw)) {
        pushCustomIssue(issues, ["excesses", field.key], "Must be a number");
      }
    }
  }
  return issues;
}

function applyPolicyRules(data: PolicyRuleFields, ctx: z.RefinementCtx) {
  for (const issue of getPolicyRuleIssues(data)) {
    if (issue.path[0] === "excesses") continue;
    ctx.addIssue({
      code: "custom",
      message: issue.message,
      path: issue.path,
    });
  }
}

function applyExcessRules(
  data: {
    estimatedTurnover?: AmountFieldValue;
    contractWorksSumInsured?: AmountFieldValue;
    excesses?: Record<string, string | undefined>;
  },
  ctx: z.RefinementCtx,
) {
  for (const issue of getPolicyRuleIssues(data)) {
    if (issue.path[0] !== "excesses") continue;
    ctx.addIssue({
      code: "custom",
      message: issue.message,
      path: issue.path,
    });
  }
}

const draftFields = {
  clientId: z.string().uuid(),
  policyStatusId: z.coerce.number().optional(),
  insurerCode: urlSafeField.optional(),
  insuredName: standardTextField.optional(),
  coverTypeId: z.coerce.number().optional(),
  annualCoverTypeId: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return null;
    return val;
  }, z.coerce.number().optional().nullable()),
  policyCategoryId: z.coerce.number().optional(),
  policyNumber: z.string().optional(),
  siteAddress: z.string().optional(),
  estimatedTurnover: moneyNumberOptional,
  postcode: z.string().optional(),
  stateId: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    return val;
  }, z.coerce.number().optional()),
  businessActivities: z.string().optional(),
  insuredContracts: z.string().optional(),
  geographicalScopes: z.string().optional(),
  maximumConstructionPeriod: z.coerce.number().int().min(0).optional(),
  maximumMaintenancePeriod: z.coerce.number().int().min(0).optional(),
  dateStart: z.string().optional(),
  dateEnd: z.string().optional(),
  hasExistingContractWorksCover: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    if (val === true || val === "true") return true;
    if (val === false || val === "false") return false;
    return val;
  }, z.boolean().optional()),
  currentInsurer: z.string().optional(),
  contractWorksSumInsured: moneyNumberOptional,
  displayHomes: moneyNumberOptional,
  existingStructure: moneyNumberOptional,
  section1DisplayHomes: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    return val;
  }, z.coerce.number().min(0).optional()),
  section1ExistingStructure: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    return val;
  }, z.coerce.number().min(0).optional()),
  plantEquipment: moneyNumberOptional,
  liabilityLimitBand: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    return val;
  }, z.coerce.number().optional()),
  claimsCountLast3Years: z.preprocess((val) => {
    const stripped = stripAmountCommas(val);
    if (stripped === "" || stripped == null) return undefined;
    return stripped;
  }, z.coerce.number().int().min(0).optional()),
  anyClaimsExceed20k: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    if (val === true || val === "true") return true;
    if (val === false || val === "false") return false;
    return val;
  }, z.boolean().optional()),
  declarationConfirmed: z.coerce.boolean().optional(),
  subLimits: subLimitsSchema.partial().optional(),
  excesses: excessesSchema.partial().optional(),
  excludedContracts1: z.string().optional(),
  excludedContracts2: z.string().optional(),
  excludedContracts3: z.string().optional(),
  selectedWordingIds: z.array(z.coerce.number()).optional(),
  customWordings: z.preprocess(
    (val) => (val == null ? [] : val),
    z
      .array(
        z.object({
          id: z.string(),
          subject: z.string(),
          content: z.string(),
        }),
      )
      .optional(),
  ),
  /** Optional manual premium override saved with the draft. */
  premium: z.record(z.string(), z.number()).optional(),
  /** Premium Breakdown lines the broker click-edited (yellow highlight). */
  premiumManualKeys: z.array(z.string()).optional(),
};

/** Autosave / leave-without-full-validation — do not enforce Taken-gate rules. */
export const carPolicyDraftSchema = z.object(draftFields);

/**
 * Full premium breakdown shape for save overrides (manual edits).
 * Loose record keeps draft/save tolerant of extra keys.
 */
export const premiumBreakdownSchema = z.record(z.string(), z.number());

export type PremiumBreakdownInput = z.infer<typeof premiumBreakdownSchema>;

/** Parse an optional premium override from a save/draft payload. */
export function parsePremiumOverride(
  payload: unknown,
): PremiumBreakdownInput | undefined {
  if (!payload || typeof payload !== "object" || !("premium" in payload)) {
    return undefined;
  }
  const parsed = premiumBreakdownSchema.safeParse(
    (payload as { premium?: unknown }).premium,
  );
  return parsed.success ? parsed.data : undefined;
}

/** Minimum fields required for premium calculation */
export const carPolicyPricingSchema = z
  .object({
    coverTypeId: z.coerce.number().min(1),
    estimatedTurnover: moneyNumberPositive,
    postcode: z.string().regex(/^\d{4}$/),
    stateId: z.preprocess((val) => {
      if (val === "" || val === null || val === undefined) return undefined;
      return val;
    }, z.coerce.number().min(1)),
    dateStart: z.string().min(1),
    contractWorksSumInsured: moneyNumber,
    displayHomes: moneyNumber,
    existingStructure: moneyNumber,
    plantEquipment: moneyNumber,
    liabilityLimitBand: z.preprocess((val) => {
      if (val === "" || val === null || val === undefined) return undefined;
      return val;
    }, z.coerce.number().min(1)),
    claimsCountLast3Years: z.preprocess(
      (val) => {
        const stripped = stripAmountCommas(val);
        if (stripped === "" || stripped == null) return undefined;
        return stripped;
      },
      z.coerce.number({ error: "Required" }).int().min(0),
    ),
    anyClaimsExceed20k: z.preprocess(
      (val) => {
        if (val === "" || val === null || val === undefined) return undefined;
        if (val === true || val === "true") return true;
        if (val === false || val === "false") return false;
        return val;
      },
      z.boolean({
        error: "Please select whether any claims exceeded $20,000",
      }),
    ),
    hasExistingContractWorksCover: z.preprocess((val) => {
      if (val === true || val === "true") return true;
      if (val === false || val === "false") return false;
      return val;
    }, z.boolean()),
  })
  .passthrough();

export const carPolicySchema = z
  .object({
    ...baseFields,
    declarationConfirmed: z.coerce.boolean().refine((value) => value === true, {
      message: "Duty of disclosure confirmation is required",
    }),
  })
  .superRefine(applyPolicyRules)
  .superRefine(applyExcessRules);

export type CarPolicyFormValues = z.infer<typeof carPolicySchema>;

export const wizardSteps = [
  "Risk Details",
  "Limits of Liability",
  "Excesses",
  "Claims",
  "Premium",
] as const;

export const wizardStepFields: Record<number, (keyof CarPolicyFormValues)[]> = {
  0: [
    "insurerCode",
    "insuredName",
    "coverTypeId",
    "annualCoverTypeId",
    "policyCategoryId",
    "policyNumber",
    "siteAddress",
    "postcode",
    "stateId",
    "estimatedTurnover",
    "businessActivities",
    "insuredContracts",
    "geographicalScopes",
    "maximumConstructionPeriod",
    "maximumMaintenancePeriod",
    "dateStart",
    "dateEnd",
    "hasExistingContractWorksCover",
    "currentInsurer",
  ],
  1: [
    "contractWorksSumInsured",
    "displayHomes",
    "existingStructure",
    "plantEquipment",
    "subLimits",
    "liabilityLimitBand",
  ],
  2: ["excesses"],
  3: [
    "claimsCountLast3Years",
    "anyClaimsExceed20k",
    "excludedContracts1",
    "excludedContracts2",
    "excludedContracts3",
    "declarationConfirmed",
    "selectedWordingIds",
    "customWordings",
  ],
  4: ["policyStatusId"],
};

export const pricingFields = [
  "coverTypeId",
  "estimatedTurnover",
  "postcode",
  "stateId",
  "dateStart",
  "contractWorksSumInsured",
  "displayHomes",
  "existingStructure",
  "plantEquipment",
  "liabilityLimitBand",
  "claimsCountLast3Years",
  "anyClaimsExceed20k",
  "hasExistingContractWorksCover",
] as const satisfies readonly (keyof CarPolicyFormValues)[];
