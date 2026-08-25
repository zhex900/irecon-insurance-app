import type { ReactNode } from "react";

import type { Policy, ReferenceData } from "~/lib/db/types";
import type { NoteAuthor } from "~/lib/services/users/service";

export type { PolicyPhase } from "./policy-phase";
export {
  derivePolicyPhase,
  isEditablePhase,
  policyPhaseCardBorderClass,
  policyPhaseHeaderClass,
} from "./policy-phase";

export type WizardProps = {
  policy: Policy;
  reference: ReferenceData;
  /** Live broker fee schedule still loading (`usePolicyFeeNames`). */
  referenceFeeNamesPending?: boolean;
  freshSteps?: boolean;
  /** True only when arriving from /policies/new (?new=1); cleared from URL immediately. */
  initialIsNew?: boolean;
  clientName?: string;
  noteAuthors?: Record<string, NoteAuthor>;
  onPolicyUpdated?: (policy: Policy) => void;
  headerActions?: ReactNode;
};
