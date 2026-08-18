/**
 * Backend-driven policy list queries: SQL filters + limit/offset + counts.
 */
import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  lte,
  or,
  type SQL,
  sql,
} from "drizzle-orm";

import { getDb } from "~/lib/db/client";
import {
  client,
  policy,
  policyCar,
  policyCarAdjustment,
} from "~/lib/db/schema";
import { type PageResult, toPageResult } from "~/lib/pagination";
import {
  EXPIRY_PRESETS,
  type ExpiryPresetId,
  INCEPTION_PRESETS,
  type InceptionPresetId,
  rangeForExpiryPreset,
  rangeForInceptionPreset,
} from "~/lib/search/date-range-filter";
import type { ListReferenceData } from "~/lib/services/reference.service";
import { likePattern, resolvePage } from "~/lib/services/shared/list-query";

export type PolicyListClientSummary = {
  clientId: string;
  name: string;
  tradingName: string;
  abn: string;
  phone: string;
  email: string;
  accountManagerId: number;
};

export type PolicyListItem = {
  policyId: string;
  policyNumber: string;
  clientId: string;
  clientName: string;
  client: PolicyListClientSummary;
  policyStatusId: number;
  policyCategoryId: number;
  coverTypeId: number;
  insuredName: string;
  dateStart: string;
  dateEnd: string;
  isDraft: boolean;
  adjusted: boolean;
  originalTotalPremium: number | null;
  createdWhen: string;
};

export type ListPoliciesPageInput = {
  search?: string;
  /** @deprecated Prefer `policyStatusIds`. */
  policyStatusId?: number | null;
  policyStatusIds?: number[];
  coverTypeIds?: number[];
  policyCategoryIds?: number[];
  /** @deprecated Prefer `clientIds`. */
  clientId?: string | null;
  clientIds?: string[];
  /** Inclusive inception date bounds as `YYYY-MM-DD`. */
  inceptionFrom?: string | null;
  inceptionTo?: string | null;
  /** Inclusive expiry date bounds as `YYYY-MM-DD`. */
  expiryFrom?: string | null;
  expiryTo?: string | null;
  limit?: number;
  offset?: number;
};

function resolveClientIds(input: ListPoliciesPageInput): string[] {
  if (input.clientIds && input.clientIds.length > 0) {
    return [...new Set(input.clientIds.filter(Boolean))];
  }
  if (input.clientId) {
    return [input.clientId];
  }
  return [];
}

function resolveStatusIds(input: ListPoliciesPageInput): number[] {
  if (input.policyStatusIds && input.policyStatusIds.length > 0) {
    return [...new Set(input.policyStatusIds)];
  }
  if (input.policyStatusId != null && input.policyStatusId > 0) {
    return [input.policyStatusId];
  }
  return [];
}

export type PolicyListPremiumTotals = {
  totalBasePremiumExGst: number;
  totalBrokerFeeExGst: number;
};

export type PolicyListMeta = {
  statusCounts: Record<number, number>;
  coverCounts: Record<number, number>;
  categoryCounts: Record<number, number>;
  inceptionPresetCounts: Record<string, number>;
  expiryPresetCounts: Record<string, number>;
};

export type PolicyListMetaResponse = PolicyListMeta & { allCount: number };

export type PolicyListStatsResponse = {
  meta: PolicyListMetaResponse;
  reference: ListReferenceData;
};

export type ListPoliciesPageResult = PageResult<PolicyListItem> &
  PolicyListPremiumTotals &
  PolicyListMeta;

export type ListPoliciesPageOptions = {
  includePremium?: boolean;
  includeMeta?: boolean;
};

const EMPTY_PREMIUM: PolicyListPremiumTotals = {
  totalBasePremiumExGst: 0,
  totalBrokerFeeExGst: 0,
};

const EMPTY_META: PolicyListMeta = {
  statusCounts: {},
  coverCounts: {},
  categoryCounts: {},
  inceptionPresetCounts: {},
  expiryPresetCounts: {},
};

type FilterOmit = {
  omitStatus?: boolean;
  omitCover?: boolean;
  omitCategory?: boolean;
  omitClient?: boolean;
  omitInception?: boolean;
  omitExpiry?: boolean;
};

type DatePreset = { id: string };

function startOfDay(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`);
}

function endOfDay(isoDate: string) {
  return new Date(`${isoDate}T23:59:59.999`);
}

/** ISO strings for raw `sql` fragments — postgres.js on Workers rejects Date params. */
function dateRangeSqlBounds(from: string, to: string) {
  return {
    from: startOfDay(from).toISOString(),
    to: endOfDay(to).toISOString(),
  };
}

function presetResultKey(id: string) {
  return id.replace(/-/g, "_");
}

function buildPolicyListFilters(
  input: ListPoliciesPageInput,
  options?: FilterOmit,
): SQL[] {
  const filters: SQL[] = [];
  const statusIds = resolveStatusIds(input);
  const coverIds = input.coverTypeIds?.filter((id) => id > 0) ?? [];
  const categoryIds = input.policyCategoryIds?.filter((id) => id > 0) ?? [];
  const clientIds = resolveClientIds(input);

  if (!options?.omitClient && clientIds.length > 0) {
    filters.push(inArray(policy.clientId, clientIds));
  }
  if (!options?.omitStatus && statusIds.length > 0) {
    filters.push(inArray(policy.policyStatusId, statusIds));
  }
  if (!options?.omitCover && coverIds.length > 0) {
    filters.push(inArray(policyCar.coverTypeId, coverIds));
  }
  if (!options?.omitCategory && categoryIds.length > 0) {
    filters.push(inArray(policy.policyCategoryId, categoryIds));
  }
  if (!options?.omitInception) {
    if (input.inceptionFrom) {
      filters.push(
        gte(policy.dateStart, new Date(`${input.inceptionFrom}T00:00:00`)),
      );
    }
    if (input.inceptionTo) {
      filters.push(
        lte(policy.dateStart, new Date(`${input.inceptionTo}T23:59:59.999`)),
      );
    }
  }
  if (!options?.omitExpiry) {
    if (input.expiryFrom) {
      filters.push(
        gte(policy.dateEnd, new Date(`${input.expiryFrom}T00:00:00`)),
      );
    }
    if (input.expiryTo) {
      filters.push(
        lte(policy.dateEnd, new Date(`${input.expiryTo}T23:59:59.999`)),
      );
    }
  }

  const q = input.search?.trim();
  if (q) {
    const pattern = likePattern(q);
    const textOr: SQL[] = [
      ilike(policy.policyNumber, pattern),
      ilike(policyCar.insuredName, pattern),
      ilike(client.name, pattern),
      ilike(client.tradingName, pattern),
    ];
    if (q.toLowerCase() === "adjusted") {
      textOr.push(isNotNull(policyCarAdjustment.policyId));
    }
    filters.push(or(...textOr)!);
  }

  return filters;
}

async function countByGroup(
  input: ListPoliciesPageInput,
  omit: FilterOmit,
  group: {
    column:
      | typeof policy.policyStatusId
      | typeof policy.policyCategoryId
      | typeof policyCar.coverTypeId;
  },
): Promise<Record<number, number>> {
  const db = getDb();
  const filters = buildPolicyListFilters(input, omit);
  const where = filters.length > 0 ? and(...filters) : undefined;
  const rows = await db
    .select({
      id: group.column,
      count: sql<number>`count(*)::int`,
    })
    .from(policy)
    .innerJoin(policyCar, eq(policy.policyId, policyCar.policyId))
    .leftJoin(client, eq(policy.clientId, client.clientId))
    .leftJoin(
      policyCarAdjustment,
      eq(policy.policyId, policyCarAdjustment.policyId),
    )
    .where(where)
    .groupBy(group.column);

  const counts: Record<number, number> = {};
  for (const row of rows) {
    if (row.id == null) continue;
    counts[Number(row.id)] = Number(row.count);
  }
  return counts;
}

async function sumPolicyListPremiums(
  input: ListPoliciesPageInput,
): Promise<PolicyListPremiumTotals> {
  const db = getDb();
  const filters = buildPolicyListFilters(input);
  const where = filters.length > 0 ? and(...filters) : undefined;
  const [row] = await db
    .select({
      totalBasePremiumExGst: sql<number>`coalesce(sum(
        coalesce(${policyCar.contractWorksBasePremium}, 0) +
        coalesce(${policyCar.liabilityBasePremium}, 0)
      ), 0)::float`,
      totalBrokerFeeExGst: sql<number>`coalesce(sum(
        coalesce((${policyCar.appExtras}->>'combinedBrokerFee')::numeric, 0) * 10 / 11
      ), 0)::float`,
    })
    .from(policy)
    .innerJoin(policyCar, eq(policy.policyId, policyCar.policyId))
    .leftJoin(client, eq(policy.clientId, client.clientId))
    .leftJoin(
      policyCarAdjustment,
      eq(policy.policyId, policyCarAdjustment.policyId),
    )
    .where(where);

  return {
    totalBasePremiumExGst: Number(row?.totalBasePremiumExGst ?? 0),
    totalBrokerFeeExGst: Number(row?.totalBrokerFeeExGst ?? 0),
  };
}

async function countWithFilters(
  input: ListPoliciesPageInput,
  omit?: FilterOmit,
): Promise<number> {
  const db = getDb();
  const filters = buildPolicyListFilters(input, omit);
  const where = filters.length > 0 ? and(...filters) : undefined;
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(policy)
    .innerJoin(policyCar, eq(policy.policyId, policyCar.policyId))
    .leftJoin(client, eq(policy.clientId, client.clientId))
    .leftJoin(
      policyCarAdjustment,
      eq(policy.policyId, policyCarAdjustment.policyId),
    )
    .where(where);
  return Number(row?.count ?? 0);
}

type PolicyListRow = Awaited<ReturnType<typeof selectPolicyListRows>>[number];

function mapPolicyListRows(rows: PolicyListRow[]): PolicyListItem[] {
  return rows.map((row) => {
    const clientName = row.clientName?.trim() || "—";
    return {
      policyId: row.policyId,
      policyNumber: row.policyNumber,
      clientId: row.clientId,
      clientName,
      client: {
        clientId: row.clientId,
        name: clientName,
        tradingName: row.clientTradingName?.trim() ?? "",
        abn: row.clientAbn?.trim() ?? "",
        phone: row.clientPhone?.trim() ?? "",
        email: row.clientEmail?.trim() ?? "",
        accountManagerId: row.clientAccountManagerId ?? 0,
      },
      policyStatusId: row.policyStatusId,
      policyCategoryId: row.policyCategoryId,
      coverTypeId: row.coverTypeId,
      insuredName: row.insuredName ?? "",
      dateStart: row.dateStart.toISOString().slice(0, 10),
      dateEnd: row.dateEnd.toISOString().slice(0, 10),
      isDraft: Boolean(row.isDraft),
      adjusted: row.adjustmentPolicyId != null,
      originalTotalPremium:
        row.originalTotalPremium == null
          ? null
          : Number(row.originalTotalPremium),
      createdWhen: row.createdWhen.toISOString(),
    };
  });
}

async function selectPolicyListRows(
  input: ListPoliciesPageInput,
  pagination: ReturnType<typeof resolvePage>,
) {
  const db = getDb();
  const filters = buildPolicyListFilters(input);
  const where = filters.length > 0 ? and(...filters) : undefined;
  return db
    .select({
      policyId: policy.policyId,
      policyNumber: policy.policyNumber,
      clientId: policy.clientId,
      clientName: client.name,
      clientTradingName: client.tradingName,
      clientAbn: client.abn,
      clientPhone: client.phone,
      clientEmail: client.email,
      clientAccountManagerId: client.accountManagerId,
      policyStatusId: policy.policyStatusId,
      policyCategoryId: policy.policyCategoryId,
      coverTypeId: policyCar.coverTypeId,
      insuredName: policyCar.insuredName,
      dateStart: policy.dateStart,
      dateEnd: policy.dateEnd,
      isDraft: policy.isDraft,
      adjustmentPolicyId: policyCarAdjustment.policyId,
      originalTotalPremium: policyCar.originalTotalPremium,
      createdWhen: policy.createdWhen,
    })
    .from(policy)
    .innerJoin(policyCar, eq(policy.policyId, policyCar.policyId))
    .leftJoin(client, eq(policy.clientId, client.clientId))
    .leftJoin(
      policyCarAdjustment,
      eq(policy.policyId, policyCarAdjustment.policyId),
    )
    .where(where)
    .orderBy(desc(policy.createdWhen), desc(policy.policyId))
    .limit(pagination.limit)
    .offset(pagination.offset);
}

/** Filter badge counts for the policies list (separate from row fetch for async loading). */
export async function getPolicyListMeta(
  input: ListPoliciesPageInput = {},
): Promise<PolicyListMeta> {
  const [facetCounts, datePresetCounts] = await Promise.all([
    countAllFacetGroups(input),
    countAllDatePresets(input),
  ]);

  return {
    ...facetCounts,
    ...datePresetCounts,
  };
}

/** Status / cover / category counts — sequential to stay within the query gate. */
async function countAllFacetGroups(
  input: ListPoliciesPageInput,
): Promise<
  Pick<
    PolicyListMeta,
    "statusCounts" | "coverCounts" | "categoryCounts"
  >
> {
  const statusCounts = await countByGroup(
    input,
    { omitStatus: true },
    { column: policy.policyStatusId },
  );
  const coverCounts = await countByGroup(
    input,
    { omitCover: true },
    { column: policyCar.coverTypeId },
  );
  const categoryCounts = await countByGroup(
    input,
    { omitCategory: true },
    { column: policy.policyCategoryId },
  );
  return { statusCounts, coverCounts, categoryCounts };
}

/** Table rows + pagination only — used by list loaders that fetch meta via `/api/*`. */
export async function listPoliciesPageCore(
  input: ListPoliciesPageInput = {},
): Promise<PageResult<PolicyListItem>> {
  const pagination = resolvePage(input);
  const [total, rows] = await Promise.all([
    countWithFilters(input),
    selectPolicyListRows(input, pagination),
  ]);
  return toPageResult(mapPolicyListRows(rows), total, pagination);
}

/** Inception + expiry preset badge counts — sequential (different filter bases). */
async function countAllDatePresets(input: ListPoliciesPageInput): Promise<{
  inceptionPresetCounts: Record<string, number>;
  expiryPresetCounts: Record<string, number>;
}> {
  const inceptionPresetCounts = await countDatePresets(
    input,
    INCEPTION_PRESETS,
    (id) => rangeForInceptionPreset(id as InceptionPresetId),
    policy.dateStart,
    { omitInception: true },
  );
  const expiryPresetCounts = await countDatePresets(
    input,
    EXPIRY_PRESETS,
    (id) => rangeForExpiryPreset(id as ExpiryPresetId),
    policy.dateEnd,
    { omitExpiry: true },
  );
  return { inceptionPresetCounts, expiryPresetCounts };
}

/** One scan for preset badge counts on a single date column. */
async function countDatePresets(
  input: ListPoliciesPageInput,
  presets: readonly DatePreset[],
  rangeForPreset: (id: string) => { from: string; to: string },
  dateColumn: typeof policy.dateStart | typeof policy.dateEnd,
  omit: Pick<FilterOmit, "omitInception" | "omitExpiry">,
): Promise<Record<string, number>> {
  const db = getDb();
  const filters = buildPolicyListFilters(input, omit);
  const where = filters.length > 0 ? and(...filters) : undefined;

  const selectShape: Record<string, SQL.Aliased<number>> = {};
  for (const preset of presets) {
    const range = rangeForPreset(preset.id);
    const key = presetResultKey(preset.id);
    const bounds = dateRangeSqlBounds(range.from, range.to);
    selectShape[key] = sql<number>`count(*) filter (where ${dateColumn} >= ${bounds.from} and ${dateColumn} <= ${bounds.to})::int`.as(
      key,
    );
  }

  const [row] = await db
    .select(selectShape)
    .from(policy)
    .innerJoin(policyCar, eq(policy.policyId, policyCar.policyId))
    .leftJoin(client, eq(policy.clientId, client.clientId))
    .leftJoin(
      policyCarAdjustment,
      eq(policy.policyId, policyCarAdjustment.policyId),
    )
    .where(where);
  const counts: Record<string, number> = {};
  for (const preset of presets) {
    const key = presetResultKey(preset.id);
    counts[preset.id] = Number(row?.[key as keyof typeof row] ?? 0);
  }
  return counts;
}

/** Policy counts for specific clients under current filters (client filter omitted). */
export async function countPoliciesForClientIds(
  input: ListPoliciesPageInput,
  clientIds: string[],
): Promise<Record<string, number>> {
  const ids = [...new Set(clientIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const db = getDb();
  const filters = buildPolicyListFilters(input, { omitClient: true });
  filters.push(inArray(policy.clientId, ids));
  const where = and(...filters);
  const rows = await db
    .select({
      clientId: policy.clientId,
      count: sql<number>`count(*)::int`,
    })
    .from(policy)
    .innerJoin(policyCar, eq(policy.policyId, policyCar.policyId))
    .leftJoin(client, eq(policy.clientId, client.clientId))
    .leftJoin(
      policyCarAdjustment,
      eq(policy.policyId, policyCarAdjustment.policyId),
    )
    .where(where)
    .groupBy(policy.clientId);
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.clientId] = Number(row.count);
  }
  return counts;
}

export async function listPoliciesPage(
  input: ListPoliciesPageInput = {},
  options: ListPoliciesPageOptions = {},
): Promise<ListPoliciesPageResult> {
  const includePremium = options.includePremium ?? false;
  const includeMeta = options.includeMeta ?? true;

  const [core, premiumTotals, meta] = await Promise.all([
    listPoliciesPageCore(input),
    includePremium ? sumPolicyListPremiums(input) : Promise.resolve(EMPTY_PREMIUM),
    includeMeta ? getPolicyListMeta(input) : Promise.resolve(EMPTY_META),
  ]);

  return { ...core, ...premiumTotals, ...meta };
}
