/**
 * Seed Supabase local Postgres from _archive/data/*.json
 * ARs are loaded from _archive/seeds-source/WholesaleBroker.csv.
 * Users are created in Supabase Auth + app_user profile.
 * Usage: npm run db:seed
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { getDb } from "../../../app/lib/db/client";
import {
  client,
  policy,
  policyCar,
  policyCarAdjustment,
  policyCarSelectedWording,
  policyDocument,
  policyNote,
} from "../../../app/lib/db/schema";
import { policyToRows } from "../../../app/lib/db/policy-mapper";
import type { Policy } from "../../../app/lib/db/types";
import { createUser } from "../../../app/lib/services/users/service";
import {
  legacyClientUuid,
  legacyPolicyUuid,
} from "../legacy/lib/legacy-id-map.mts";
import { attachPolicySeriesFields } from "../lib/policy-series-import.mts";
import { syncPolicyNumberSeqFromPolicies } from "../lib/policy-number-seq.mts";
import { getSupabaseAdmin } from "../../../app/lib/supabase/admin.server";
import { seedAuthorisedRepresentativesFromCsv } from "./seed-ar-from-csv.mts";
import { seedPrices } from "./seed-prices";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const wholesaleBrokerCsv = join(
  root,
  "_archive/seeds-source/WholesaleBroker.csv",
);

function readJson<T>(name: string): T {
  return JSON.parse(
    readFileSync(join(root, "_archive/data", name), "utf8"),
  ) as T;
}

async function clearAuthUsers() {
  const admin = getSupabaseAdmin();
  // Paginate through Auth users and remove them so seed is idempotent.
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 100,
    });
    if (error) throw new Error(error.message);
    const users = data.users ?? [];
    if (users.length === 0) break;
    for (const user of users) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
      if (deleteError) throw new Error(deleteError.message);
    }
  }
}

async function main() {
  const db = getDb();
  const users = readJson<
    Array<{
      fullName: string;
      email: string;
      role: "broker" | "admin";
      authorisedRepresentativeId: number | null;
      disabled: boolean;
      password: string;
    }>
  >("users.json");
  const clients = readJson<
    Array<{
      clientId: number;
      name: string;
      tradingName: string;
      abn: string;
      phone: string;
      email: string;
      accountManagerId: number;
      clientSourceId: number;
      authorisedRepresentativeId: number;
      createdWhen: string;
      createdBy: string;
    }>
  >("clients.json");
  type SeedPolicyRow = Omit<Policy, "policyId" | "clientId"> & {
    policyId: number;
    clientId: number;
  };
  const policies = readJson<SeedPolicyRow[]>("policies.json");

  console.log("Clearing Supabase Auth users…");
  await clearAuthUsers();

  console.log("Truncating tables…");
  await db.execute(sql`
    TRUNCATE TABLE
      policy_car_selected_wording,
      policy_note,
      policy_document,
      policy_car_adjustment,
      policy_car,
      policy,
      policy_series,
      client,
      app_user,
      authorised_representative
    RESTART IDENTITY CASCADE
  `);

  const ars = await seedAuthorisedRepresentativesFromCsv(wholesaleBrokerCsv);
  const fallbackArId = ars[0]?.authorisedRepresentativeId ?? 1;
  const arIds = ars.map((ar) => ar.authorisedRepresentativeId);
  const resolveArId = (id: number | null) => {
    if (id == null) return null;
    return arIds.includes(id) ? id : fallbackArId;
  };

  console.log(`Seeding ${users.length} users via Supabase Auth…`);
  for (const user of users) {
    await createUser({
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      authorisedRepresentativeId: resolveArId(user.authorisedRepresentativeId),
      disabled: user.disabled,
      password: user.password,
    });
  }

  console.log(`Seeding ${clients.length} clients…`);
  for (const c of clients) {
    await db.insert(client).values({
      clientId: legacyClientUuid(c.clientId),
      name: c.name,
      tradingName: c.tradingName,
      abn: c.abn,
      phone: c.phone,
      email: c.email,
      accountManagerId: c.accountManagerId,
      clientSourceId: c.clientSourceId,
      authorisedRepresentativeId: resolveArId(c.authorisedRepresentativeId)!,
      createdWhen: new Date(c.createdWhen),
      createdBy: c.createdBy,
    });
  }

  console.log("Seeding price catalogues…");
  await seedPrices();

  console.log(`Seeding ${policies.length} policies…`);
  const policiesWithSeries = await attachPolicySeriesFields(
    policies.map((p) => ({
      clientId: legacyClientUuid(p.clientId),
      policyNumber: String(p.policyNumber),
      createdBy: p.createdBy,
      createdWhen: p.createdWhen,
    })),
  );
  for (let i = 0; i < policies.length; i++) {
    const seedRow = policies[i]!;
    const series = policiesWithSeries[i]!;
    const policyDoc: Policy = {
      ...seedRow,
      policyId: legacyPolicyUuid(seedRow.policyId),
      clientId: legacyClientUuid(seedRow.clientId),
      policySeriesId: series.policySeriesId,
      seriesNumber: series.seriesNumber,
      insurerCode: seedRow.insurerCode ?? "ATC",
      isDraft: seedRow.isDraft ?? !seedRow.car?.premium,
    };
    const {
      policyValues,
      carValues,
      adjustmentValues,
      documentValues,
      noteValues,
      selectedWordingIds,
    } = policyToRows(policyDoc);
    await db.insert(policy).values(policyValues);
    await db.insert(policyCar).values(carValues);
    if (adjustmentValues) {
      await db.insert(policyCarAdjustment).values(adjustmentValues);
    }
    if (documentValues.length > 0) {
      await db.insert(policyDocument).values(documentValues);
    }
    if (noteValues.length > 0) {
      await db.insert(policyNote).values(noteValues);
    }
    if (selectedWordingIds.length > 0) {
      await db.insert(policyCarSelectedWording).values(
        selectedWordingIds.map((carWordingId) => ({
          policyId: policyDoc.policyId,
          carWordingId,
        })),
      );
    }
  }

  await db.execute(sql`
    SELECT setval(
      pg_get_serial_sequence('authorised_representative', 'authorised_representative_id'),
      (SELECT COALESCE(MAX(authorised_representative_id), 1) FROM authorised_representative)
    );
  `);
  await syncPolicyNumberSeqFromPolicies(db);

  console.log("Seed complete. Demo password for seeded users: password123");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
