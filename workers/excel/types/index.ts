// Re-export worker-types for backward compatibility
export type {
  AdjustmentBreakdown,
  AdjustmentSectionRow,
  CarInfo,
  Policy,
  PremiumBreakdown,
  RatingSnapshot,
} from "~/lib/excel/types";

// Export generate types
export type {
  GenerateGenericExcelFunction,
  GenerateGenericExcelRequestData,
  GeneratePremiumExcelFunction,
  GeneratePremiumExcelOptions,
  GeneratePremiumExcelRequestData,
} from "./generate-types";
