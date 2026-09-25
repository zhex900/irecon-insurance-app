import { sql } from "drizzle-orm";

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

export const policySeriesCanonicalSuffixExpr = sql`
  (regexp_replace(upper(split_part(ps.series_number, '-', 1)), '^ATCCWI', ''))::bigint
`;

export const policySeriesIsCanonicalExpr = sql`
  upper(split_part(ps.series_number, '-', 1)) ~ '^ATCCWI[0-9]{1,4}$'
`;

/** Max numeric suffix among canonical policy numbers (for policy_number_seq sync). */
export const POLICY_NUMBER_SEQ_MAX_SUFFIX_SQL = sql`
  (
    SELECT MAX(${policyNumberCanonicalSuffixExpr})
    FROM public.policy p
    WHERE ${policyNumberIsCanonicalExpr}
  )
`;

const lowestFreeSuffixFromPolicyOnly = sql`
  NOT EXISTS (
    SELECT 1
    FROM public.policy p
    WHERE ${policyNumberIsCanonicalExpr}
      AND ${policyNumberCanonicalSuffixExpr} = s
  )
`;

const lowestFreeSuffixSeriesTaken = sql`
  NOT EXISTS (
    SELECT 1
    FROM public.policy_series ps
    WHERE ${policySeriesIsCanonicalExpr}
      AND ${policySeriesCanonicalSuffixExpr} = s
  )
`;

/** Smallest suffix free on {@link policy.policyNumber} only (e.g. renewal term numbers). */
export const POLICY_NUMBER_LOWEST_FREE_SUFFIX_SQL = sql`
  (
    SELECT s AS suffix
    FROM generate_series(1000, 9999) AS s
    WHERE ${lowestFreeSuffixFromPolicyOnly}
    ORDER BY s
    LIMIT 1
  )
`;

/**
 * Smallest suffix free for new business where policy_number and series_number
 * will match (both unique indexes must be satisfied).
 */
export const POLICY_NUMBER_LOWEST_FREE_SUFFIX_RESERVE_SERIES_SQL = sql`
  (
    SELECT s AS suffix
    FROM generate_series(1000, 9999) AS s
    WHERE ${lowestFreeSuffixFromPolicyOnly}
      AND ${lowestFreeSuffixSeriesTaken}
    ORDER BY s
    LIMIT 1
  )
`;
