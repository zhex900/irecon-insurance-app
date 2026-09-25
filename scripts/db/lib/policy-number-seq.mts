import type { sql as SqlTag } from "drizzle-orm";
import { sql } from "drizzle-orm";

import { POLICY_NUMBER_SEQ_MAX_SUFFIX_SQL } from "../../../app/lib/policies/policy-number-sql.ts";

type DbExecute = {
  execute: (query: ReturnType<typeof SqlTag>) => Promise<unknown>;
};

/** Match supabase/migrations/20260806120000_client_policy_uuid_ids.sql */
export async function ensurePolicyNumberSeq(db: DbExecute): Promise<void> {
  await db.execute(sql`
    CREATE SEQUENCE IF NOT EXISTS public.policy_number_seq START WITH 1000
  `);
}

export { POLICY_NUMBER_SEQ_MAX_SUFFIX_SQL };

/** Set sequence to max(canonical ATCCWI#### suffix among policies, 1000). */
export async function syncPolicyNumberSeqFromPolicies(
  db: DbExecute,
): Promise<void> {
  await ensurePolicyNumberSeq(db);
  await db.execute(sql`
    SELECT setval(
      'public.policy_number_seq',
      GREATEST(
        1000,
        LEAST(
          9999,
          COALESCE(${POLICY_NUMBER_SEQ_MAX_SUFFIX_SQL}, 1000)
        )
      )
    )
  `);
}
