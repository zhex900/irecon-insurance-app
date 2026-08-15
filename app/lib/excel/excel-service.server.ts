import type {
  GeneratePremiumExcelFunction,
  GenerateGenericExcelFunction,
} from "../../../workers/excel/types/generate-types";

export type ExcelServiceBinding = {
  generatePremiumExcel: GeneratePremiumExcelFunction;
  generateGenericExcel: GenerateGenericExcelFunction;
};
