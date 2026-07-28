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
import { getDb } from "../app/lib/db/client";
import {
  client,
  policy,
  policyCar,
  policyCarAdjustment,
} from "../app/lib/db/schema";
import { policyToRows } from "../app/lib/db/policy-mapper";
import type { Policy } from "../app/lib/db/types";
import { createUser } from "../app/lib/services/users/service";
import { getSupabaseAdmin } from "../app/lib/supabase/admin.server";
import { seedAuthorisedRepresentativesFromCsv } from "./seed-ar-from-csv";
import { seedPrices } from "./seed-prices";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
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
  const policies = readJson<Policy[]>("policies.json");

  console.log("Clearing Supabase Auth users…");
  await clearAuthUsers();

  console.log("Truncating tables…");
  await db.execute(sql`
    TRUNCATE TABLE
      policy_car_adjustment,
      policy_car,
      policy,
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
      clientId: c.clientId,
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
  for (const p of policies) {
    const { policyValues, carValues, adjustmentValues } = policyToRows({
      ...p,
      insurerCode: p.insurerCode ?? "ATC",
      isDraft: p.isDraft ?? !p.car?.premium,
    });
    await db.insert(policy).values(policyValues);
    await db.insert(policyCar).values(carValues);
    if (adjustmentValues) {
      await db.insert(policyCarAdjustment).values(adjustmentValues);
    }
  }

  await db.execute(sql`
    SELECT setval(pg_get_serial_sequence('authorised_representative', 'authorised_representative_id'),
      (SELECT COALESCE(MAX(authorised_representative_id), 1) FROM authorised_representative));
    SELECT setval(pg_get_serial_sequence('client', 'client_id'),
      (SELECT COALESCE(MAX(client_id), 1) FROM client));
    SELECT setval(pg_get_serial_sequence('policy', 'policy_id'),
      (SELECT COALESCE(MAX(policy_id), 1) FROM policy));
  `);

  console.log("Seed complete. Demo password for seeded users: password123");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
