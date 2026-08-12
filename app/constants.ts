/**
 * Shared application constants.
 * Safe for client + server imports unless noted otherwise.
 *
 * @see docs/pricing/car-premium-formulas.md §1 (GST)
 */

/** App-wide calendar timezone — keeps SSR (Workers UTC) and browser output aligned. */
export const BUSINESS_TIME_ZONE = "Australia/Sydney";

/** Australian GST — legacy `GSTRate` (10%). */
export const GST_RATE = 0.1;

/** Terrorism levy effective from this certificate date (legacy CARCalculator). */
export const TERROR_START_DATE = "2021-01-01";

/** Plant premium rule change from this certificate date. */
export const VERSION_21_START_DATE = "2023-01-01";

/** CW sum insured threshold for post-terror plant banding rules. */
export const PLANT_CERTIFICATE_TURNOVER_LIMIT = 2_500_000;

/** Shared audit action codes. */
export const AUDIT_ACTIONS = [
  "auth.login",
  "auth.logout",
  "client.create",
  "client.update",
  "client.delete",
  "policy.create",
  "policy.save",
  "policy.clone",
  "policy.delete",
  "policy.status_change",
  "policy.adjust",
  "policy.documents_generate",
  "policy.documents_email",
  "user.create",
  "user.update",
  "user.disable",
  "user.enable",
  "user.delete",
  "ar.create",
  "ar.update",
  "ar.delete",
  "account_manager.create",
  "account_manager.update",
  "account_manager.delete",
  "settings.feature_toggle",
  "settings.email_template",
  "settings.library_document_upload",
  "settings.library_document_delete",
  "settings.library_document_label",
  "settings.library_document_cover_types",
  "price.create",
  "price.update",
  "price.delete",
  "report.export",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number] | (string & {});
