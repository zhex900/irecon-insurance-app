#!/usr/bin/env tsx
/**
 * Create public.policy_number_seq when missing (e.g. drizzle push / partial restore).
 *
 *   pnpm run db:repair:policy-number-seq
 */
import "dotenv/config";

import { getDb, resetSharedDbPool } from "../../../app/lib/db/client";
import { syncPolicyNumberSeqFromPolicies } from "../lib/policy-number-seq.mts";

async function main() {
  const db = getDb();
  await syncPolicyNumberSeqFromPolicies(db);
  console.log(
    "✓ public.policy_number_seq is ready and synced from policy rows",
  );
  resetSharedDbPool();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
