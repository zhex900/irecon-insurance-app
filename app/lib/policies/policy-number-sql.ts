import { sql } from "drizzle-orm";

import {
  POLICY_NUMBER_SUFFIX_MAX,
  POLICY_NUMBER_SUFFIX_MIN,
} from "~/lib/policies/policy-number";

/**
 * Canonical ATCCWI#### numeric suffix from a policy row (ignores legacy `-YYYY` tails
 * and non-canonical policy_number values). Shared by seq sync and gap-fill allocation.
 */
export const policyNumberCanonicalSuffixExpr = sql`
  (regexp_replace(upper(split_part(p.policy_number, '-', 1)), '^ATCCWI', ''))::bigint
`;

export const policyNumberIsCanonicalExpr = sql`
  upper(split_part(p.policy_number, '-', 1)) ~ '^ATCCWI[0-9]{1,4}$'
`;

/** Max numeric suffix among canonical policy numbers (for policy_number_seq sync). */
export const POLICY_NUMBER_SEQ_MAX_SUFFIX_SQL = sql`
  (
    SELECT MAX(${policyNumberCanonicalSuffixExpr})
    FROM public.policy p
    WHERE ${policyNumberIsCanonicalExpr}
  )
`;

/** Smallest unused canonical suffix in the legacy allocation range. */
export const POLICY_NUMBER_LOWEST_FREE_SUFFIX_SQL = sql`
  (
    SELECT s AS suffix
    FROM generate_series(
      ${POLICY_NUMBER_SUFFIX_MIN}::integer,
      ${POLICY_NUMBER_SUFFIX_MAX}::integer
    ) AS s
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.policy p
      WHERE ${policyNumberIsCanonicalExpr}
        AND ${policyNumberCanonicalSuffixExpr} = s
    )
    ORDER BY s
    LIMIT 1
  )
`;
