/**
 * Versioned pricing catalogues (db.txt Price* + BrokerFeeSchedule*).
 */
import {
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  primaryKey,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const policyType = pgTable("policy_type", {
  policyTypeId: integer("policy_type_id").primaryKey(),
  code: varchar("code", { length: 32 }).notNull(),
  name: varchar("name", { length: 64 }).notNull(),
});

export const coverType = pgTable("cover_type", {
  coverTypeId: integer("cover_type_id").primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),
});

export const state = pgTable("state", {
  stateId: integer("state_id").primaryKey(),
  code: varchar("code", { length: 8 }).notNull(),
  name: varchar("name", { length: 64 }).notNull(),
});

export const brokerFeeSchedule = pgTable("broker_fee_schedule", {
  brokerFeeScheduleId: serial("broker_fee_schedule_id").primaryKey(),
  policyTypeId: integer("policy_type_id").notNull().default(1),
  dateStart: date("date_start").notNull(),
  published: boolean("published").notNull().default(false),
  datePublished: timestamp("date_published", { withTimezone: true }),
  createdWhen: timestamp("created_when", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: varchar("created_by", { length: 255 }).notNull().default(""),
});

export const brokerFeeScheduleLine = pgTable(
  "broker_fee_schedule_line",
  {
    brokerFeeScheduleId: integer("broker_fee_schedule_id").notNull(),
    sortOrder: integer("sort_order").notNull(),
    name: varchar("name", { length: 255 }).notNull().default(""),
    fee: numeric("fee", { precision: 18, scale: 4 }).notNull().default("0"),
    feeGst: numeric("fee_gst", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
  },
  (t) => [primaryKey({ columns: [t.brokerFeeScheduleId, t.sortOrder] })],
);

export const price = pgTable("price", {
  priceId: serial("price_id").primaryKey(),
  policyTypeId: integer("policy_type_id").notNull().default(1),
  dateStart: date("date_start").notNull(),
  published: boolean("published").notNull().default(false),
  datePublished: timestamp("date_published", { withTimezone: true }),
  createdWhen: timestamp("created_when", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: varchar("created_by", { length: 255 }).notNull().default(""),
});

export const priceCar = pgTable(
  "price_car",
  {
    priceId: integer("price_id").notNull(),
    coverTypeId: integer("cover_type_id").notNull(),
    turnoverMin: numeric("turnover_min", { precision: 18, scale: 4 }).notNull(),
    turnoverMax: numeric("turnover_max", { precision: 18, scale: 4 }),
    contractWorksRate: numeric("contract_works_rate", {
      precision: 18,
      scale: 8,
    })
      .notNull()
      .default("0"),
    contractWorksMinPremium: numeric("contract_works_min_premium", {
      precision: 18,
      scale: 4,
    })
      .notNull()
      .default("0"),
    liability10mRate: numeric("liability_10m_rate", {
      precision: 18,
      scale: 8,
    })
      .notNull()
      .default("0"),
    liability10mMinPremium: numeric("liability_10m_min_premium", {
      precision: 18,
      scale: 4,
    })
      .notNull()
      .default("0"),
    liability20mRate: numeric("liability_20m_rate", {
      precision: 18,
      scale: 8,
    })
      .notNull()
      .default("0"),
    liability20mMinPremium: numeric("liability_20m_min_premium", {
      precision: 18,
      scale: 4,
    })
      .notNull()
      .default("0"),
  },
  (t) => [primaryKey({ columns: [t.priceId, t.coverTypeId, t.turnoverMin] })],
);

export const priceEsl = pgTable("price_esl", {
  priceEslId: serial("price_esl_id").primaryKey(),
  policyTypeId: integer("policy_type_id").notNull().default(1),
  dateStart: date("date_start").notNull(),
  published: boolean("published").notNull().default(false),
  datePublished: timestamp("date_published", { withTimezone: true }),
  createdWhen: timestamp("created_when", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: varchar("created_by", { length: 255 }).notNull().default(""),
});

export const priceEslRate = pgTable("price_esl_rate", {
  priceEslRateId: serial("price_esl_rate_id").primaryKey(),
  priceEslId: integer("price_esl_id").notNull(),
  stateId: integer("state_id").notNull(),
  constructionRate: numeric("construction_rate", { precision: 18, scale: 8 })
    .notNull()
    .default("0"),
  plantRate: numeric("plant_rate", { precision: 18, scale: 8 })
    .notNull()
    .default("0"),
});

export const pricePlant = pgTable("price_plant", {
  pricePlantId: serial("price_plant_id").primaryKey(),
  policyTypeId: integer("policy_type_id").notNull().default(1),
  rate: numeric("rate", { precision: 18, scale: 8 }).notNull().default("0"),
  plantMinValue: numeric("plant_min_value", { precision: 18, scale: 4 })
    .notNull()
    .default("0"),
  plantMaxValue: numeric("plant_max_value", { precision: 18, scale: 4 })
    .notNull()
    .default("0"),
  dateStart: date("date_start").notNull(),
  published: boolean("published").notNull().default(false),
  datePublished: timestamp("date_published", { withTimezone: true }),
  createdWhen: timestamp("created_when", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: varchar("created_by", { length: 255 }).notNull().default(""),
});

export const priceStampDuty = pgTable("price_stamp_duty", {
  priceStampDutyId: serial("price_stamp_duty_id").primaryKey(),
  policyTypeId: integer("policy_type_id").notNull().default(1),
  dateStart: date("date_start").notNull(),
  published: boolean("published").notNull().default(false),
  datePublished: timestamp("date_published", { withTimezone: true }),
  createdWhen: timestamp("created_when", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: varchar("created_by", { length: 255 }).notNull().default(""),
});

export const priceStampDutyRate = pgTable("price_stamp_duty_rate", {
  priceStampDutyRateId: serial("price_stamp_duty_rate_id").primaryKey(),
  priceStampDutyId: integer("price_stamp_duty_id").notNull(),
  stateId: integer("state_id").notNull(),
  rate: numeric("rate", { precision: 18, scale: 8 }).notNull().default("0"),
});

export const priceTerrorism = pgTable("price_terrorism", {
  priceTerrorismId: serial("price_terrorism_id").primaryKey(),
  policyTypeId: integer("policy_type_id").notNull().default(1),
  dateStart: date("date_start").notNull(),
  published: boolean("published").notNull().default(false),
  datePublished: timestamp("date_published", { withTimezone: true }),
  createdWhen: timestamp("created_when", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: varchar("created_by", { length: 255 }).notNull().default(""),
});

export const priceTerrorismRate = pgTable("price_terrorism_rate", {
  priceTerrorismRateId: serial("price_terrorism_rate_id").primaryKey(),
  priceTerrorismId: integer("price_terrorism_id").notNull(),
  tier: varchar("tier", { length: 32 }).notNull(),
  rate: numeric("rate", { precision: 18, scale: 8 }).notNull().default("0"),
});

export const priceTerrorismPostcode = pgTable(
  "price_terrorism_postcode",
  {
    priceTerrorismRateId: integer("price_terrorism_rate_id").notNull(),
    postcode: varchar("postcode", { length: 16 }).notNull(),
    stateId: integer("state_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.priceTerrorismRateId, t.postcode] })],
);
