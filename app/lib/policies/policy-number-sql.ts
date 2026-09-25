import { type SQL, sql } from "drizzle-orm";

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

export const policySeriesCanonicalSuffixExpr = sql`
  (regexp_replace(upper(split_part(ps.series_number, '-', 1)), '^ATCCWI', ''))::bigint
`;

export const policySeriesIsCanonicalExpr = sql`
  upper(split_part(ps.series_number, '-', 1)) ~ '^ATCCWI[0-9]{1,4}$'
`;

/** Matches unique-index equality for allocated ATCCWI#### (see formatPolicyNumberFromSeq). */
const policyExactAllocatedNumberMatch = sql`
  lower(trim(p.policy_number)) = lower(concat('ATCCWI', lpad(s::text, 4, '0')))
`;

const seriesExactAllocatedNumberMatch = sql`
  lower(trim(ps.series_number)) = lower(concat('ATCCWI', lpad(s::text, 4, '0')))
`;

const policySuffixTaken = sql`
  EXISTS (
    SELECT 1
    FROM public.policy p
    WHERE (
      ${policyNumberIsCanonicalExpr}
      AND ${policyNumberCanonicalSuffixExpr} = s
    )
    OR ${policyExactAllocatedNumberMatch}
  )
`;

const seriesSuffixTaken = sql`
  EXISTS (
    SELECT 1
    FROM public.policy_series ps
    WHERE (
      ${policySeriesIsCanonicalExpr}
      AND ${policySeriesCanonicalSuffixExpr} = s
    )
    OR ${seriesExactAllocatedNumberMatch}
  )
`;

/** Max numeric suffix among canonical policy numbers (for policy_number_seq sync). */
export const POLICY_NUMBER_SEQ_MAX_SUFFIX_SQL = sql`
  (
    SELECT MAX(${policyNumberCanonicalSuffixExpr})
    FROM public.policy p
    WHERE ${policyNumberIsCanonicalExpr}
  )
`;

function clampAllocationMinSuffix(minSuffix: number): number {
  return Math.max(
    POLICY_NUMBER_SUFFIX_MIN,
    Math.min(POLICY_NUMBER_SUFFIX_MAX, Math.floor(minSuffix)),
  );
}

/**
 * Smallest free suffix >= minSuffix. `reserveSeries` includes policy_series rows.
 * Bounds are integer literals so generate_series overload is unambiguous.
 */
export function lowestFreePolicyNumberSuffixSubquery(
  reserveSeries: boolean,
  minSuffix: number = POLICY_NUMBER_SUFFIX_MIN,
): SQL {
  const min = clampAllocationMinSuffix(minSuffix);
  const seriesClause = reserveSeries
    ? sql`AND NOT (${seriesSuffixTaken})`
    : sql``;

  return sql`
    (
      SELECT s AS suffix
      FROM generate_series(${sql.raw(String(min))}, ${sql.raw(String(POLICY_NUMBER_SUFFIX_MAX))}) AS s
      WHERE NOT (${policySuffixTaken})
      ${seriesClause}
      ORDER BY s
      LIMIT 1
    )
  `;
}

/** @deprecated Use {@link lowestFreePolicyNumberSuffixSubquery} */
export const POLICY_NUMBER_LOWEST_FREE_SUFFIX_SQL =
  lowestFreePolicyNumberSuffixSubquery(false);

/** @deprecated Use {@link lowestFreePolicyNumberSuffixSubquery} */
export const POLICY_NUMBER_LOWEST_FREE_SUFFIX_RESERVE_SERIES_SQL =
  lowestFreePolicyNumberSuffixSubquery(true);
