import {
  annualDocuments,
  annualPremiumBreakdown,
  annualPremiumBreakdownTaken,
  annualReferralReasons,
  createAnnualMatrixInput,
} from "./annual-shared";
import type { PolicyMatrixScenario } from "./types";

export const annualTakenScenario = {
  name: "annual-taken",
  terminalState: "taken",
  input: createAnnualMatrixInput(),
  expected: {
    documents: [...annualDocuments],
    referralReasons: [...annualReferralReasons],
    premiumBreakdown: annualPremiumBreakdown,
    premiumBreakdownTaken: annualPremiumBreakdownTaken,
  },
} satisfies PolicyMatrixScenario;
