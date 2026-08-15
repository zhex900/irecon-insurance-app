import type { GeneratePremiumExcelRequestData } from "../../../workers/excel/types/generate-types";
import type { GenerateGenericExcelRequestData } from "../../../workers/excel/types/generate-types";

export type ExcelServiceBinding = {
  generatePremiumExcel(
    requestData: GeneratePremiumExcelRequestData,
  ): Promise<Response>;
  generateGenericExcel(
    requestData: GenerateGenericExcelRequestData,
  ): Promise<Response>;
  /** Cloudflare Workers service binding fetch method */
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};
