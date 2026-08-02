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
  sql,
  type SQL,
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
  INCEPTION_PRESETS,
  rangeForExpiryPreset,
  rangeForInceptionPreset,
  type ExpiryPresetId,
  type InceptionPresetId,
} from "~/lib/search/date-range-filter";
import { likePattern, resolvePage } from "~/lib/services/shared/list-query";

export type PolicyListClientSummary = {
  clientId: number;
  name: string;
  tradingName: string;
  abn: string;
  phone: string;
  email: string;
  accountManagerId: number;
};

export type PolicyListItem = {
  policyId: number;
  policyNumber: string;
  clientId: number;
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
  clientId?: number | null;
  clientIds?: number[];
  /** Inclusive inception date bounds as `YYYY-MM-DD`. */
  inceptionFrom?: string | null;
  inceptionTo?: string | null;
  /** Inclusive expiry date bounds as `YYYY-MM-DD`. */
  expiryFrom?: string | null;
  expiryTo?: string | null;
  limit?: number;
  offset?: number;
};

function resolveClientIds(input: ListPoliciesPageInput): number[] {
  if (input.clientIds && input.clientIds.length > 0) {
    return [...new Set(input.clientIds.filter((id) => id > 0))];
  }
  if (input.clientId != null && input.clientId > 0) {
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

export type ListPoliciesPageResult = PageResult<PolicyListItem> & {
  statusCounts: Record<number, number>;
  coverCounts: Record<number, number>;
  categoryCounts: Record<number, number>;
  inceptionPresetCounts: Record<string, number>;
  expiryPresetCounts: Record<string, number>;
};

type FilterOmit = {
  omitStatus?: boolean;
  omitCover?: boolean;
  omitCategory?: boolean;
  omitClient?: boolean;
  omitInception?: boolean;
  omitExpiry?: boolean;
};

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
    if (/^\d+$/.test(q)) {
      textOr.push(eq(policy.policyId, Number(q)));
    }
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
      | typeof policyCar.coverTypeId
      | typeof policy.clientId;
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

/** Policy counts for specific clients under current filters (client filter omitted). */
export async function countPoliciesForClientIds(
  input: ListPoliciesPageInput,
  clientIds: number[],
): Promise<Record<number, number>> {
  const ids = [...new Set(clientIds.filter((id) => id > 0))];
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
  const counts: Record<number, number> = {};
  for (const row of rows) {
    counts[row.clientId] = Number(row.count);
  }
  return counts;
}

export async function listPoliciesPage(
  input: ListPoliciesPageInput = {},
): Promise<ListPoliciesPageResult> {
  const db = getDb();
  const pagination = resolvePage(input);
  const filters = buildPolicyListFilters(input);
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [
    total,
    statusCounts,
    coverCounts,
    categoryCounts,
    inceptionPresetCounts,
    expiryPresetCounts,
    rows,
  ] = await Promise.all([
    countWithFilters(input),
    countByGroup(
      input,
      { omitStatus: true },
      {
        column: policy.policyStatusId,
      },
    ),
    countByGroup(
      input,
      { omitCover: true },
      {
        column: policyCar.coverTypeId,
      },
    ),
    countByGroup(
      input,
      { omitCategory: true },
      {
        column: policy.policyCategoryId,
      },
    ),
    (async () => {
      const counts: Record<string, number> = {};
      await Promise.all(
        INCEPTION_PRESETS.map(async (preset) => {
          const range = rangeForInceptionPreset(preset.id as InceptionPresetId);
          // Replace any active inception filter with this preset’s range.
          counts[preset.id] = await countWithFilters({
            ...input,
            inceptionFrom: range.from,
            inceptionTo: range.to,
          });
        }),
      );
      return counts;
    })(),
    (async () => {
      const counts: Record<string, number> = {};
      await Promise.all(
        EXPIRY_PRESETS.map(async (preset) => {
          const range = rangeForExpiryPreset(preset.id as ExpiryPresetId);
          counts[preset.id] = await countWithFilters({
            ...input,
            expiryFrom: range.from,
            expiryTo: range.to,
          });
        }),
      );
      return counts;
    })(),
    db
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
      .offset(pagination.offset),
  ]);

  const items: PolicyListItem[] = rows.map((row) => {
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

  return {
    ...toPageResult(items, total, pagination),
    statusCounts,
    coverCounts,
    categoryCounts,
    inceptionPresetCounts,
    expiryPresetCounts,
  };
}
