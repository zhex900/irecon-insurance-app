import type {
  AdjustmentBreakdown,
  Policy,
  PremiumBreakdown,
  RatingSnapshot,
} from "~/lib/db/types";

export type ExcelServiceBinding = {
  generatePremiumExcel(requestData: {
    reportType: string;
    data: {
      policy: Policy;
      premium: PremiumBreakdown;
      rating?: RatingSnapshot;
      adjustment?: AdjustmentBreakdown;
    };
    options?: Record<string, unknown>;
  }): Promise<Response>;
};
