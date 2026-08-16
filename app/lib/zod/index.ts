/**
 * Barrel exports for all Zod schemas used in the application.
 *
 * Import schemas directly from "~/lib/zod" for cleaner imports.
 *
 * Example:
 * ```ts
 * import { accountManagerSchema, type AccountManagerFormValues } from "~/lib/zod";
 * ```
 */

export {
  accountManagerSchema,
  type AccountManagerFormValues,
} from "./account-manager";

export {
  appUserSchema,
  appUserCreateSchema,
  parseAppUserFormData,
  type AppUserFormValues,
  profileUpdateSchema,
  type ProfileUpdateFormValues,
  parseProfileFormData,
} from "./app-user";

export {
  authorisedRepresentativeSchema,
  type AuthorisedRepresentativeFormValues,
} from "./authorised-representative";

export {
  carWordingFormSchema,
  type CarWordingFormValues,
  type CarWordingFormInput,
} from "./car-wording";

export {
  clientDraftSchema,
  clientSchema,
  clientToFormValues,
  formValuesToClientInput,
  type ClientFormValues,
} from "./client";

export {
  carAdjustmentInputSchema,
  type CarAdjustmentInput,
} from "./policy-adjustment";

export {
  POLICY_STATUS,
  isTerminalStatus,
  carPolicySchema,
  carPolicyDraftSchema,
  carPolicyPricingSchema,
  premiumBreakdownSchema,
  parsePremiumOverride,
  wizardSteps,
  wizardStepFields,
  pricingFields,
  getPolicyRuleIssues,
  type CarPolicyFormValues,
  type PremiumBreakdownInput,
} from "./policy-car";

export {
  queryTextSchema,
  optionalIsoDateSchema,
  positiveIntegerSchema,
  uuidParamSchema,
  booleanFlagSchema,
  searchParamsObject,
  parsePositiveInteger,
  parseUuid,
  formDataObject,
  parseFormIntent,
  invalidInputResponse,
} from "~/lib/http/route-input";
