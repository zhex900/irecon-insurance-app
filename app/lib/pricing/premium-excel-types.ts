import type {
  AdjustmentBreakdown,
  Policy,
  PremiumBreakdown,
  RatingSnapshot,
} from "~/lib/db/types";

/** Bump when Premium / Policy / Rates / Adjustment sheet layout or formulas change. */
export const PREMIUM_EXCEL_SPREADSHEET_VERSION = "1.4";

export type BuildPremiumExcelInput = {
  policy: Policy;
  premium: PremiumBreakdown;
  rating?: RatingSnapshot;
  adjustment?: AdjustmentBreakdown;
  generatedBy: string;
  appVersion?: string;
};

/** Cell refs on the Policy sheet (row map documented in policy-sheet module). */
export type PremiumExcelPolicyRefs = {
  readonly turnover: string;
  readonly plant: string;
  readonly dhPremium: string;
  readonly esPremium: string;
  readonly brokerFee: string;
  readonly adjTurnover: string;
  readonly sdExempt: string;
  readonly bindCwTrue: string;
  readonly bindCwTerror: string;
  readonly bindLlTrue: string;
  readonly bindCwEsl: string;
  readonly bindCwGst: string;
  readonly bindCwSd: string;
  readonly bindLlEsl: string;
  readonly bindLlGst: string;
  readonly bindLlSd: string;
  readonly bindCwBase: string;
  readonly bindLlBase: string;
  readonly bindCwPlant: string;
  readonly bindCwPlantTerror: string;
  readonly bindCwPlantEsl: string;
};

/** Cell refs on the Rates sheet. */
export type PremiumExcelRateRefs = {
  readonly cwRate: string;
  readonly cwMin: string;
  readonly llRate: string;
  readonly llMin: string;
  readonly plantRate: string;
  readonly esl: string;
  readonly plantEsl: string;
  readonly sd1: string;
  readonly sd2: string;
  readonly terror: string;
  readonly gst: string;
};

export type PremiumExcelSheetContext = {
  policy: Policy;
  premium: PremiumBreakdown;
  rating?: RatingSnapshot;
  adjustment?: AdjustmentBreakdown;
  coverLabel: string;
  turnoverLabel: string;
  generatedAt: Date;
  version: string;
};
