/**
 * Constants for the policy wizard to eliminate magic strings
 * and improve type safety across the codebase.
 */

// Intent constants for API actions
export const INTENTS = {
  RECALCULATE: "recalculate",
  SAVE: "save",
} as const;

// Section IDs for navigation and UI
export const SECTION_IDS = {
  POLICY_INFORMATION: "policy-information",
  PREMIUM: "premium",
  // Add other section IDs as they appear in the codebase
} as const;

// Common dialog names/types
export const DIALOG_TYPES = {
  SUBMIT_CONFIRM: "submit-confirm",
  LEAVE_DISCARD: "leave-discard",
  WORDING_DETAILS: "wording-details",
  WORKING: "working",
} as const;

// Common form field paths/roots (for error handling, validation, etc.)
export const FIELD_PATHS = {
  DISPLAY_HOMES: "displayHomes",
  EXISTING_STRUCTURE: "existingStructure",
  CLAIMS_COUNT_LAST_3_YEARS: "claimsCountLast3Years",
  ANY_CLAIMS_EXCEED_20K: "anyClaimsExceed20k",
  HAS_EXISTING_CONTRACT_WORKS_COVER: "hasExistingContractWorksCover",
  PLANT_EQUIPMENT: "plantEquipment",
  LIABILITY_LIMIT_BAND: "liabilityLimitBand",
  DATE_START: "dateStart",
} as const;

// Common CSS class names for consistent styling
export const CLASS_NAMES = {
  POLICY_STICKY_RAIL: "policy-sticky-rail",
  WIZARD_MODE_BORDER: "border-wizard-mode-",
} as const;

// Navigation/memory keys
export const MEMORY_KEYS = {
  WIZARD_STEP: "wizard-step",
  MAX_STEP: "wizard-max-step",
  FOCUS_SECTION: "wizard-focus-section",
  WIZARD_LEAVE: "wizard-leave",
} as const;

// Common error messages or status texts
export const STATUS_TEXTS = {
  TAKEN: "Taken",
  NOT_TAKEN: "Not taken",
  DRAFT: "draft",
  NEW: "new",
  EDIT: "edit",
  VIEW: "view",
} as const;

// Common timeout/delay values in milliseconds
export const TIMINGS = {
  AUTO_CALCULATION_DEBOUNCE: 300,
  DRAFT_SAVE_DEBOUNCE: 500,
  KEYBOARD_SHORTCUT_DEBOUNCE: 100,
} as const;

// Export a combined constants object for convenience
export const CONSTANTS = {
  INTENTS,
  SECTION_IDS,
  DIALOG_TYPES,
  FIELD_PATHS,
  CLASS_NAMES,
  MEMORY_KEYS,
  STATUS_TEXTS,
  TIMINGS,
} as const;
