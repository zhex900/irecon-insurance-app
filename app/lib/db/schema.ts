/**
 * Drizzle schema for Phase 1 mutable tables (from db.txt).
 * Lookups (states, cover types, etc.) still load from ~/lib/reference-data for now.
 * PolicyCARExcessDefault is in DB and used for new-policy excess defaults.
 *
 * Naming: snake_case columns in Postgres; camelCase in the TypeScript app via mappers.
 */
import {
  bigint,
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const authorisedRepresentative = pgTable("authorised_representative", {
  authorisedRepresentativeId: serial(
    "authorised_representative_id",
  ).primaryKey(),
  fullName: varchar("full_name", { length: 255 }).notNull().default(""),
  companyName: varchar("company_name", { length: 255 }).notNull().default(""),
  arNumber: varchar("ar_number", { length: 64 }).notNull().default(""),
  mobilePhone: varchar("mobile_phone", { length: 64 }).notNull().default(""),
  businessPhone: varchar("business_phone", { length: 64 })
    .notNull()
    .default(""),
  email: varchar("email", { length: 255 }).notNull().default(""),
  ownBroker: boolean("own_broker").notNull().default(false),
  createdWhen: timestamp("created_when", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: varchar("created_by", { length: 255 }).notNull().default(""),
});

/**
 * App login profile — 1:1 with Supabase Auth (`auth.users.id`).
 */
export const appUser = pgTable("app_user", {
  userId: uuid("user_id").primaryKey(),
  fullName: varchar("full_name", { length: 255 }).notNull().default(""),
  email: varchar("email", { length: 255 }).notNull(),
  role: varchar("role", { length: 32 }).notNull().default("broker"),
  authorisedRepresentativeId: integer("authorised_representative_id"),
  /** Soft-disable — kept in sync with Auth ban when managed in Settings. */
  disabled: boolean("disabled").notNull().default(false),
  /** R2 object key/version for profile photo; null = Gravatar/initials. */
  avatarR2Key: varchar("avatar_r2_key", { length: 512 }),
  createdWhen: timestamp("created_when", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Per-user side-nav Recents stack (newest first; app keeps ≤5). */
export const appUserRecentRoute = pgTable(
  "app_user_recent_route",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.userId, { onDelete: "cascade" }),
    path: varchar("path", { length: 512 }).notNull(),
    label: varchar("label", { length: 255 }).notNull().default(""),
    visitedWhen: timestamp("visited_when", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.path] })],
);

export const client = pgTable("client", {
  clientId: serial("client_id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().default(""),
  tradingName: varchar("trading_name", { length: 255 }).notNull().default(""),
  abn: varchar("abn", { length: 32 }).notNull().default(""),
  phone: varchar("phone", { length: 64 }).notNull().default(""),
  email: varchar("email", { length: 255 }).notNull().default(""),
  accountManagerId: integer("account_manager_id").notNull().default(1),
  clientSourceId: integer("client_source_id").notNull().default(16),
  authorisedRepresentativeId: integer("authorised_representative_id")
    .notNull()
    .default(1),
  createdWhen: timestamp("created_when", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: varchar("created_by", { length: 255 }).notNull().default(""),
});

export const policy = pgTable("policy", {
  policyId: serial("policy_id").primaryKey(),
  clientId: integer("client_id").notNull(),
  policyTypeId: integer("policy_type_id").notNull().default(1),
  policyStatusId: integer("policy_status_id").notNull().default(1),
  postcode: varchar("postcode", { length: 16 }).notNull().default(""),
  stateId: integer("state_id").notNull().default(2),
  policyCategoryId: integer("policy_category_id").notNull().default(1),
  policyNumber: varchar("policy_number", { length: 64 }).notNull(),
  dateStart: timestamp("date_start", { withTimezone: true }).notNull(),
  dateEnd: timestamp("date_end", { withTimezone: true }).notNull(),
  insurerCode: varchar("insurer_code", { length: 32 }).notNull().default("ATC"),
  policyGroupId: integer("policy_group_id"),
  copiedFromPolicyId: integer("copied_from_policy_id"),
  takenAt: timestamp("taken_at", { withTimezone: true }),
  takenBy: varchar("taken_by", { length: 255 }),
  /** App convenience — not in db.txt; derive from !premium later. */
  isDraft: boolean("is_draft").notNull().default(true),
  createdWhen: timestamp("created_when", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: varchar("created_by", { length: 255 }).notNull().default(""),
  updatedWhen: timestamp("updated_when", { withTimezone: true }),
});

/**
 * 1:1 with policy. Premium columns match db.txt PolicyCAR;
 * jsonb holds sub-limits, wordings, and interim app fields (excesses, docs, notes, rating).
 */
export const policyCar = pgTable("policy_car", {
  policyId: integer("policy_id").primaryKey(),
  coverTypeId: integer("cover_type_id").notNull().default(1),
  siteAddress: text("site_address").notNull().default(""),
  insuredName: varchar("insured_name", { length: 255 }).notNull().default(""),
  estimatedTurnover: numeric("estimated_turnover", { precision: 18, scale: 2 })
    .notNull()
    .default("0"),
  businessActivities: text("business_activities").notNull().default(""),
  insuredContracts: text("insured_contracts").notNull().default(""),
  geographicalScopes: text("geographical_scopes").notNull().default(""),
  plantEquipment: numeric("plant_equipment", { precision: 18, scale: 2 })
    .notNull()
    .default("0"),
  existingStructure: numeric("existing_structure", { precision: 18, scale: 2 })
    .notNull()
    .default("0"),
  displayHomes: numeric("display_homes", { precision: 18, scale: 2 })
    .notNull()
    .default("0"),
  claimsCountLast3Years: integer("claims_count_last_3_years")
    .notNull()
    .default(0),
  anyClaimsExceed20k: boolean("any_claims_exceed_20k").notNull().default(false),
  declarationConfirmed: boolean("declaration_confirmed")
    .notNull()
    .default(false),
  contractWorksSumInsured: numeric("contract_works_sum_insured", {
    precision: 18,
    scale: 2,
  })
    .notNull()
    .default("0"),
  liabilityLimitBand: integer("liability_limit_band").notNull().default(1),
  hasExistingContractWorksCover: boolean("has_existing_contract_works_cover")
    .notNull()
    .default(false),
  currentInsurer: varchar("current_insurer", { length: 255 })
    .notNull()
    .default(""),
  maximumConstructionPeriod: integer("maximum_construction_period")
    .notNull()
    .default(18),
  maximumMaintenancePeriod: integer("maximum_maintenance_period")
    .notNull()
    .default(12),

  // Premium / rating columns (db.txt)
  contractWorksCalculatedBasePremium: numeric(
    "contract_works_calculated_base_premium",
    { precision: 18, scale: 4 },
  ),
  contractWorksBasePremium: numeric("contract_works_base_premium", {
    precision: 18,
    scale: 4,
  }),
  contractWorksExistingStructurePremium: numeric(
    "contract_works_existing_structure_premium",
    { precision: 18, scale: 4 },
  ),
  contractWorksPlantPremium: numeric("contract_works_plant_premium", {
    precision: 18,
    scale: 4,
  }),
  contractWorksPlantEsl: numeric("contract_works_plant_esl", {
    precision: 18,
    scale: 4,
  }),
  contractWorksEsl: numeric("contract_works_esl", { precision: 18, scale: 4 }),
  contractWorksGst: numeric("contract_works_gst", { precision: 18, scale: 4 }),
  contractWorksStampDuty: numeric("contract_works_stamp_duty", {
    precision: 18,
    scale: 4,
  }),
  contractWorksTerrorismPremium: numeric("contract_works_terrorism_premium", {
    precision: 18,
    scale: 4,
  }),
  contractWorksPlantTerrorismPremium: numeric(
    "contract_works_plant_terrorism_premium",
    { precision: 18, scale: 4 },
  ),
  contractWorksDisplayHomesPremium: numeric(
    "contract_works_display_homes_premium",
    { precision: 18, scale: 4 },
  ),
  contractWorksTotalPremium: numeric("contract_works_total_premium", {
    precision: 18,
    scale: 4,
  }),
  liabilityCalculatedBasePremium: numeric("liability_calculated_base_premium", {
    precision: 18,
    scale: 4,
  }),
  liabilityBasePremium: numeric("liability_base_premium", {
    precision: 18,
    scale: 4,
  }),
  liabilityEsl: numeric("liability_esl", { precision: 18, scale: 4 }),
  liabilityGst: numeric("liability_gst", { precision: 18, scale: 4 }),
  liabilityStampDuty: numeric("liability_stamp_duty", {
    precision: 18,
    scale: 4,
  }),
  liabilityTotalPremium: numeric("liability_total_premium", {
    precision: 18,
    scale: 4,
  }),
  originalTotalPremium: numeric("original_total_premium", {
    precision: 18,
    scale: 4,
  }),
  contractWorksAppliedRate: numeric("contract_works_applied_rate", {
    precision: 18,
    scale: 8,
  }),
  liabilityAppliedRate: numeric("liability_applied_rate", {
    precision: 18,
    scale: 8,
  }),
  priceId: integer("price_id"),
  priceStampDutyId: integer("price_stamp_duty_id"),
  priceEslId: integer("price_esl_id"),
  priceTerrorismId: integer("price_terrorism_id"),
  pricePlantId: integer("price_plant_id"),
  annualCoverTypeId: integer("annual_cover_type_id"),
  plantRate: numeric("plant_rate", { precision: 18, scale: 8 }),
  eslRate: numeric("esl_rate", { precision: 18, scale: 8 }),
  plantEslRate: numeric("plant_esl_rate", { precision: 18, scale: 8 }),
  contractWorksStampDutyRate: numeric("contract_works_stamp_duty_rate", {
    precision: 18,
    scale: 8,
  }),
  liabilityStampDutyRate: numeric("liability_stamp_duty_rate", {
    precision: 18,
    scale: 8,
  }),
  contractWorksMinPremium: numeric("contract_works_min_premium", {
    precision: 18,
    scale: 4,
  }),
  liabilityMinPremium: numeric("liability_min_premium", {
    precision: 18,
    scale: 4,
  }),
  plantValueMin: numeric("plant_value_min", { precision: 18, scale: 2 }),
  plantValueMax: numeric("plant_value_max", { precision: 18, scale: 2 }),
  terrorismRate: numeric("terrorism_rate", { precision: 18, scale: 8 }),
  manualTaxOverride: boolean("manual_tax_override").notNull().default(false),

  subLimits: jsonb("sub_limits")
    .$type<Record<string, string>>()
    .notNull()
    .default({}),
  wordings: jsonb("wordings").$type<unknown[]>().notNull().default([]),

  /**
   * Interim bag for app fields not yet normalized:
   * excesses, documents, notes, referralReasons, selectedWordingIds,
   * custom wording, rating extras, combinedBrokerFee, excludedContracts*.
   */
  appExtras: jsonb("app_extras")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
});

export const policyCarAdjustment = pgTable("policy_car_adjustment", {
  policyId: integer("policy_id").primaryKey(),
  adjustedTurnover: numeric("adjusted_turnover", { precision: 18, scale: 2 })
    .notNull()
    .default("0"),
  stampDutyExempt: boolean("stamp_duty_exempt").notNull().default(false),
  deltaContractWorksBasePremium: numeric("delta_contract_works_base_premium", {
    precision: 18,
    scale: 4,
  })
    .notNull()
    .default("0"),
  deltaContractWorksTerrorismPremium: numeric(
    "delta_contract_works_terrorism_premium",
    { precision: 18, scale: 4 },
  )
    .notNull()
    .default("0"),
  deltaContractWorksEsl: numeric("delta_contract_works_esl", {
    precision: 18,
    scale: 4,
  })
    .notNull()
    .default("0"),
  deltaContractWorksGst: numeric("delta_contract_works_gst", {
    precision: 18,
    scale: 4,
  })
    .notNull()
    .default("0"),
  deltaContractWorksStampDuty: numeric("delta_contract_works_stamp_duty", {
    precision: 18,
    scale: 4,
  })
    .notNull()
    .default("0"),
  deltaContractWorksTotalPremium: numeric(
    "delta_contract_works_total_premium",
    { precision: 18, scale: 4 },
  )
    .notNull()
    .default("0"),
  deltaLiabilityBasePremium: numeric("delta_liability_base_premium", {
    precision: 18,
    scale: 4,
  })
    .notNull()
    .default("0"),
  deltaLiabilityEsl: numeric("delta_liability_esl", { precision: 18, scale: 4 })
    .notNull()
    .default("0"),
  deltaLiabilityGst: numeric("delta_liability_gst", { precision: 18, scale: 4 })
    .notNull()
    .default("0"),
  deltaLiabilityStampDuty: numeric("delta_liability_stamp_duty", {
    precision: 18,
    scale: 4,
  })
    .notNull()
    .default("0"),
  deltaLiabilityTotalPremium: numeric("delta_liability_total_premium", {
    precision: 18,
    scale: 4,
  })
    .notNull()
    .default("0"),
  deltaTotalPremium: numeric("delta_total_premium", { precision: 18, scale: 4 })
    .notNull()
    .default("0"),
  /** Full adjustment UI snapshot (breakdown + absolute totals) until Stage 2 redesign. */
  appSnapshot: jsonb("app_snapshot").$type<Record<string, unknown>>(),
  createdWhen: timestamp("created_when", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: varchar("created_by", { length: 255 }).notNull().default(""),
  updatedWhen: timestamp("updated_when", { withTimezone: true }),
  updatedBy: varchar("updated_by", { length: 255 }),
});

/**
 * Default excess catalogue for new CAR policies (db.txt PolicyCARExcessDefault; was CARExcess).
 * Per-policy values still live in policy_car.app_extras until PolicyCARExcess is normalized.
 */
export const policyCarExcessDefault = pgTable("policy_car_excess_default", {
  policyCarExcessDefaultId: integer(
    "policy_car_excess_default_id",
  ).primaryKey(),
  coverSection: integer("cover_section").notNull(),
  contractValueMin: numeric("contract_value_min", { precision: 18, scale: 4 })
    .notNull()
    .default("0"),
  contractValueMax: numeric("contract_value_max", { precision: 18, scale: 4 })
    .notNull()
    .default("0"),
  liabilityLimitMillions: integer("liability_limit_millions")
    .notNull()
    .default(0),
  name: varchar("name", { length: 255 }).notNull().default(""),
  displayOrder: integer("display_order").notNull(),
  excess: varchar("excess", { length: 64 }).notNull().default(""),
  isGroupHeading: boolean("is_group_heading").notNull().default(false),
  trailer: varchar("trailer", { length: 255 }).notNull().default(""),
  additionalNotes: boolean("additional_notes").notNull().default(false),
});

/** CAR additional wording options (broker form catalogue). */
export const carWording = pgTable("car_wording", {
  carWordingId: integer("car_wording_id").primaryKey(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
});

/** Runtime feature flags (Settings → Features, super-admin only). */
export const appFeatureFlag = pgTable("app_feature_flag", {
  featureKey: varchar("feature_key", { length: 64 }).primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  updatedWhen: timestamp("updated_when", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedBy: varchar("updated_by", { length: 255 }).notNull().default(""),
});

/** Static library PDFs attached to policy packs (Settings → Library documents; bytes in R2). */
export const libraryDocument = pgTable("library_document", {
  libraryDocumentId: bigint("library_document_id", { mode: "number" })
    .generatedAlwaysAsIdentity()
    .primaryKey(),
  filename: varchar("filename", { length: 512 }).notNull(),
  /** Label for policy documents side card (app max: DOCUMENT_LABEL_MAX_LENGTH). */
  displayName: varchar("display_name", { length: 255 }).notNull(),
  r2Key: varchar("r2_key", { length: 512 }).notNull(),
  contentType: varchar("content_type", { length: 128 })
    .notNull()
    .default("application/pdf"),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull().default(0),
  /** Empty = always; `state:2` = NSW only (etc.). */
  attachRule: varchar("attach_rule", { length: 64 }).notNull().default(""),
  createdWhen: timestamp("created_when", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: varchar("created_by", { length: 255 }).notNull().default(""),
  updatedWhen: timestamp("updated_when", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedBy: varchar("updated_by", { length: 255 }).notNull().default(""),
});

/** Document email compose templates (Settings → Email templates, super-admin). */
export const appEmailTemplate = pgTable("app_email_template", {
  recipientType: varchar("recipient_type", { length: 32 }).primaryKey(),
  subject: text("subject").notNull().default(""),
  body: text("body").notNull().default(""),
  /** Insurer only — broker uses the client's authorised representative email. */
  toEmail: varchar("to_email", { length: 255 }).notNull().default(""),
  updatedWhen: timestamp("updated_when", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedBy: varchar("updated_by", { length: 255 }).notNull().default(""),
});

/** Singleton email footer logo (data URI blob). Settings → Email templates. */
export const appEmailFooterImage = pgTable("app_email_footer_image", {
  id: integer("id").primaryKey().default(1),
  contentType: varchar("content_type", { length: 64 })
    .notNull()
    .default("image/png"),
  /** Full data URI: `data:image/png;base64,...` */
  dataUri: text("data_uri").notNull(),
  /** Render width in email HTML (px). */
  displayWidth: integer("display_width").notNull().default(520),
  updatedWhen: timestamp("updated_when", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedBy: varchar("updated_by", { length: 255 }).notNull().default(""),
});

/** Versioned CAR pdfme templates (Settings → Document templates). */
export const appDocumentTemplateVersion = pgTable(
  "app_document_template_version",
  {
    documentTemplateVersionId: bigint("document_template_version_id", {
      mode: "number",
    })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    documentTemplateKey: varchar("document_template_key", {
      length: 64,
    }).notNull(),
    /** Policy cover 1/2/3; null = included for every cover. */
    coverTypeId: integer("cover_type_id"),
    title: varchar("title", { length: 512 }).notNull().default(""),
    /** Label for policy documents side card (app max: DOCUMENT_LABEL_MAX_LENGTH). */
    label: varchar("label", { length: 255 }).notNull().default(""),
    versionNumber: integer("version_number").notNull(),
    /** pdfme Template: { basePdf, schemas }. */
    templateJson: jsonb("template_json")
      .$type<Record<string, unknown>>()
      .notNull(),
    flowPushDown: jsonb("flow_push_down").$type<Record<
      string,
      unknown
    > | null>(),
    mergeFields: jsonb("merge_fields").$type<string[]>().notNull().default([]),
    isPublished: boolean("is_published").notNull().default(false),
    createdWhen: timestamp("created_when", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: varchar("created_by", { length: 255 }).notNull().default(""),
  },
);

/** Material-action audit trail — who / what / when. */
export const auditLog = pgTable("audit_log", {
  auditLogId: bigint("audit_log_id", { mode: "number" })
    .generatedAlwaysAsIdentity()
    .primaryKey(),
  occurredAt: timestamp("occurred_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  actorUserId: uuid("actor_user_id").references(() => appUser.userId, {
    onDelete: "set null",
  }),
  actorEmail: text("actor_email").notNull().default(""),
  actorName: text("actor_name").notNull().default(""),
  action: varchar("action", { length: 64 }).notNull(),
  entityType: varchar("entity_type", { length: 64 }),
  entityId: varchar("entity_id", { length: 64 }),
  summary: text("summary").notNull(),
  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  requestPath: varchar("request_path", { length: 512 }),
});
