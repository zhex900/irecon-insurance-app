import {
  annualDocuments,
  annualPremiumBreakdown,
  annualReferralReasons,
  createAnnualMatrixInput,
} from "./annual-shared";
import type { PolicyMatrixScenario } from "./types";

export const annualNotTakenScenario = {
  name: "annual-not-taken",
  terminalState: "not-taken",
  input: createAnnualMatrixInput(),
  expected: {
    documents: [...annualDocuments],
    referralReasons: [...annualReferralReasons],
    premiumBreakdown: annualPremiumBreakdown,
  },
} satisfies PolicyMatrixScenario;
