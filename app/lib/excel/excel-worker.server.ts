import type {
  GenerateGenericExcelFunction,
  GeneratePremiumExcelFunction,
} from "../../../workers/excel/types/generate-types";

export type ExcelWorkerBinding = {
  generatePremiumExcel: GeneratePremiumExcelFunction;
  generateGenericExcel: GenerateGenericExcelFunction;
};
