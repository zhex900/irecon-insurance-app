import { createContext } from "react";

import type { PolicyPhase } from "../shared/policy-phase";

export type PolicyPhaseContextValue = {
  phase: PolicyPhase;
  canEdit: boolean;
  canShowSubmitButton: boolean;
  canChangeStatus: boolean;
  policyNumberEditable: boolean;
  premiumPinned: boolean;
  isNew: boolean;
  /** Clears session-new state after the first successful draft save. */
  dismissNewPolicy: () => void;
  freshSteps: boolean;
  /** Saved policy status is terminal (Taken / Not taken). */
  isSavedTerminal: boolean;
  /** Live form status is terminal (includes confirm-before-save). */
  isFormTerminal: boolean;
};

const defaultValue: PolicyPhaseContextValue = {
  phase: "pending",
  canEdit: true,
  canShowSubmitButton: true,
  canChangeStatus: false,
  policyNumberEditable: true,
  premiumPinned: false,
  isNew: false,
  dismissNewPolicy: () => {},
  freshSteps: false,
  isSavedTerminal: false,
  isFormTerminal: false,
};

export const PolicyPhaseContext =
  createContext<PolicyPhaseContextValue>(defaultValue);
