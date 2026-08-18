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
  type AccountManagerFormValues,
  accountManagerSchema,
} from "./account-manager";
export {
  appUserCreateSchema,
  type AppUserFormValues,
  appUserSchema,
  parseAppUserFormData,
  parseProfileFormData,
  type ProfileUpdateFormValues,
  profileUpdateSchema,
} from "./app-user";
export {
  type AuthorisedRepresentativeFormValues,
  authorisedRepresentativeSchema,
} from "./authorised-representative";
export {
  type CarWordingFormInput,
  carWordingFormSchema,
  type CarWordingFormValues,
} from "./car-wording";
export {
  clientDraftSchema,
  type ClientFormValues,
  clientSchema,
  clientToFormValues,
  formValuesToClientInput,
} from "./client";
export {
  type CarAdjustmentInput,
  carAdjustmentInputSchema,
} from "./policy-adjustment";
export {
  carPolicyDraftSchema,
  type CarPolicyFormValues,
  carPolicyPricingSchema,
  carPolicySchema,
  getPolicyRuleIssues,
  isTerminalStatus,
  parsePremiumOverride,
  POLICY_STATUS,
  type PremiumBreakdownInput,
  premiumBreakdownSchema,
  pricingFields,
  wizardStepFields,
  wizardSteps,
} from "./policy-car";
export {
  booleanFlagSchema,
  formDataObject,
  invalidInputResponse,
  isoDateStringSchema,
  optionalIsoDateSchema,
  optionalStrictIsoDateSchema,
  parseFormIntent,
  parsePositiveInteger,
  parseUuid,
  positiveIntegerSchema,
  queryTextSchema,
  searchParamsObject,
  uuidParamSchema,
} from "~/lib/http/route-input";
