import type { sql as SqlTag } from "drizzle-orm";
import { sql } from "drizzle-orm";

type DbExecute = {
  execute: (query: ReturnType<typeof SqlTag>) => Promise<unknown>;
};

/** Match supabase/migrations/20260806120000_client_policy_uuid_ids.sql */
export async function ensurePolicyNumberSeq(db: DbExecute): Promise<void> {
  await db.execute(sql`
    CREATE SEQUENCE IF NOT EXISTS public.policy_number_seq START WITH 1000
  `);
}

/**
 * Max numeric suffix for `policy_number_seq`, ignoring legacy `-YYYY` term suffixes
 * and non-canonical rows (avoids ATCCWI2746-2024-06-15 → 274620240615).
 */
export const POLICY_NUMBER_SEQ_MAX_SUFFIX_SQL = sql`
  (
    SELECT MAX(
      (regexp_replace(upper(split_part(p.policy_number, '-', 1)), '^ATCCWI', ''))::bigint
    )
    FROM public.policy p
    WHERE upper(split_part(p.policy_number, '-', 1)) ~ '^ATCCWI[0-9]{1,4}$'
  )
`;

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
