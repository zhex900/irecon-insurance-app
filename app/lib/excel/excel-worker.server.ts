import type {
  GeneratePremiumExcelFunction,
  GenerateGenericExcelFunction,
} from "../../../workers/excel/types/generate-types";

export type ExcelWorkerBinding = {
  generatePremiumExcel: GeneratePremiumExcelFunction;
  generateGenericExcel: GenerateGenericExcelFunction;
};
