// Re-export worker-types for backward compatibility
export type {
  Policy,
  PremiumBreakdown,
  RatingSnapshot,
  AdjustmentBreakdown,
  AdjustmentSectionRow,
  CarInfo,
} from "~/lib/excel/types";

// Export generate types
export type {
  GeneratePremiumExcelOptions,
  GeneratePremiumExcelRequestData,
  GeneratePremiumExcelFunction,
  GenerateGenericExcelRequestData,
  GenerateGenericExcelFunction,
} from "./generate-types";
