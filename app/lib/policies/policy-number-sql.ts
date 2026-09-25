import { type SQL, sql } from "drizzle-orm";

import {
  POLICY_NUMBER_SUFFIX_MAX,
  POLICY_NUMBER_SUFFIX_MIN,
} from "~/lib/policies/policy-number";

/**
 * Canonical ATCCWI#### numeric suffix from a policy row (ignores legacy `-YYYY` tails
 * and non-canonical policy_number values). Used for policy_number_seq sync only.
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

function clampAllocationMinSuffix(minSuffix: number): number {
  return Math.max(
    POLICY_NUMBER_SUFFIX_MIN,
    Math.min(POLICY_NUMBER_SUFFIX_MAX, Math.floor(minSuffix)),
  );
}

/** Same string shape as {@link formatPolicyNumberFromSeq} for index-aligned checks. */
const allocatedNumberForSuffix = sql`
  lower(concat('ATCCWI', lpad(s::text, 4, '0')))
`;

const policyAllocatedNumberTaken = sql`
  EXISTS (
    SELECT 1
    FROM public.policy p
    WHERE lower(trim(p.policy_number)) = ${allocatedNumberForSuffix}
  )
`;

const seriesAllocatedNumberTaken = sql`
  EXISTS (
    SELECT 1
    FROM public.policy_series ps
    WHERE lower(trim(ps.series_number)) = ${allocatedNumberForSuffix}
  )
`;

/**
 * Lowest free ATCCWI#### suffix >= minSuffix (gap-fill).
 * Matches `policy_policy_number_uidx` / `policy_series_number_uidx` equality rules.
 */
export function lowestFreePolicyNumberSuffixQuery(
  reserveSeries: boolean,
  minSuffix: number = POLICY_NUMBER_SUFFIX_MIN,
): SQL {
  const min = clampAllocationMinSuffix(minSuffix);
  const seriesClause = reserveSeries
    ? sql`AND NOT (${seriesAllocatedNumberTaken})`
    : sql``;

  return sql`
    SELECT s AS "suffix"
    FROM generate_series(${sql.raw(String(min))}, ${sql.raw(String(POLICY_NUMBER_SUFFIX_MAX))}) AS s
    WHERE NOT (${policyAllocatedNumberTaken})
    ${seriesClause}
    ORDER BY s
    LIMIT 1
  `;
}
