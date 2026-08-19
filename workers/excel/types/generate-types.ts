/**
 * Shared type definitions for Excel RPC methods.
 * Used by both the worker handler and the app service binding.
 */

import type {
  GenerateGenericExcelRequestData,
  GeneratePremiumExcelRequestData,
} from "./schemas";

export type {
  GenerateGenericExcelRequestData,
  GeneratePremiumExcelRequestData,
} from "./schemas";

export type GeneratePremiumExcelOptions = NonNullable<
  GeneratePremiumExcelRequestData["options"]
>;

export type GeneratePremiumExcelFunction = (
  requestData: GeneratePremiumExcelRequestData,
) => Promise<Response>;

export type GenerateGenericExcelFunction = (
  requestData: GenerateGenericExcelRequestData,
) => Promise<Response>;
