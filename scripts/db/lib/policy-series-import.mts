/**
 * Attach policy_series rows for bulk seed / legacy import (no app savePolicy path).
 */
import { eq, sql } from "drizzle-orm";

import { getDb } from "../../../app/lib/db/client";
import { policySeries } from "../../../app/lib/db/schema";
import {
  composePolicyNumber,
  normalizeLegacySeriesBase,
} from "../../../app/lib/policies/policy-number";

export type PolicySeriesImportInput = {
  clientId: string;
  policyNumber: string;
  policySeriesId?: string;
  seriesNumber?: string;
  createdBy?: string;
  createdWhen?: string | Date;
};

function resolveSeriesNumber(input: PolicySeriesImportInput): string {
  const raw = input.seriesNumber?.trim();
  if (raw) {
    return normalizeLegacySeriesBase(composePolicyNumber(raw));
  }
  return normalizeLegacySeriesBase(input.policyNumber);
}

function toCreatedWhen(value: string | Date | undefined): Date {
  if (value instanceof Date) return value;
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export type PolicySeriesImportResult<T extends PolicySeriesImportInput> = T & {
  policySeriesId: string;
  seriesNumber: string;
};

/**
 * Ensures each policy has a policy_series row and returns enriched policies.
 * Series keys match migration backfill ({@link normalizeLegacySeriesBase}).
 */
export async function attachPolicySeriesFields<
  T extends PolicySeriesImportInput,
>(policies: T[]): Promise<PolicySeriesImportResult<T>[]> {
  if (policies.length === 0) return [];

  const db = getDb();
  const resolvedSeries = policies.map((policy) => resolveSeriesNumber(policy));
  const output: Array<PolicySeriesImportResult<T> | null> = Array.from({
    length: policies.length,
  });

  type Pending = {
    index: number;
    seriesNumber: string;
    clientId: string;
    createdBy: string;
    createdWhen: Date;
  };
  const pending: Pending[] = [];

  for (let index = 0; index < policies.length; index++) {
    const policy = policies[index]!;
    const seriesNumber = resolvedSeries[index]!;

    if (policy.policySeriesId?.trim()) {
      const [row] = await db
        .select({
          policySeriesId: policySeries.policySeriesId,
          seriesNumber: policySeries.seriesNumber,
          clientId: policySeries.clientId,
        })
        .from(policySeries)
        .where(eq(policySeries.policySeriesId, policy.policySeriesId.trim()))
        .limit(1);
      if (!row) {
        throw new Error(
          `policy_series not found for policySeriesId ${policy.policySeriesId}`,
        );
      }
      if (String(row.clientId) !== String(policy.clientId)) {
        throw new Error(
          `policy_series ${row.seriesNumber} belongs to a different client`,
        );
      }
      output[index] = {
        ...policy,
        policySeriesId: row.policySeriesId,
        seriesNumber: policy.seriesNumber?.trim() || row.seriesNumber,
      };
      continue;
    }

    pending.push({
      index,
      seriesNumber,
      clientId: String(policy.clientId),
      createdBy: policy.createdBy?.trim() || "import",
      createdWhen: toCreatedWhen(policy.createdWhen),
    });
  }

  const groups = new Map<string, Pending[]>();
  for (const item of pending) {
    const key = `${item.clientId}:${item.seriesNumber.toLowerCase()}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  const seriesByGroupKey = new Map<
    string,
    { policySeriesId: string; seriesNumber: string }
  >();

  for (const [groupKey, items] of groups) {
    items.sort((a, b) => a.createdWhen.getTime() - b.createdWhen.getTime());
    const canonical = items[0]!;
    const lower = canonical.seriesNumber.toLowerCase();

    const [existing] = await db
      .select({
        policySeriesId: policySeries.policySeriesId,
        seriesNumber: policySeries.seriesNumber,
        clientId: policySeries.clientId,
      })
      .from(policySeries)
      .where(
        sql`lower(${policySeries.seriesNumber}) = ${lower} AND ${policySeries.clientId} = ${canonical.clientId}`,
      )
      .limit(1);

    if (existing) {
      seriesByGroupKey.set(groupKey, {
        policySeriesId: existing.policySeriesId,
        seriesNumber: existing.seriesNumber,
      });
      continue;
    }

    const [existingOtherClient] = await db
      .select({ policySeriesId: policySeries.policySeriesId })
      .from(policySeries)
      .where(sql`lower(${policySeries.seriesNumber}) = ${lower}`)
      .limit(1);

    if (existingOtherClient) {
      throw new Error(
        `Policy series ${canonical.seriesNumber} is already owned by another client in Postgres`,
      );
    }

    const [inserted] = await db
      .insert(policySeries)
      .values({
        seriesNumber: canonical.seriesNumber,
        clientId: canonical.clientId,
        createdBy: canonical.createdBy,
        createdWhen: canonical.createdWhen,
      })
      .returning({
        policySeriesId: policySeries.policySeriesId,
        seriesNumber: policySeries.seriesNumber,
      });

    if (!inserted) {
      throw new Error(
        `Failed to create policy series ${canonical.seriesNumber}`,
      );
    }

    seriesByGroupKey.set(groupKey, inserted);
  }

  for (const item of pending) {
    const policy = policies[item.index]!;
    const groupKey = `${item.clientId}:${item.seriesNumber.toLowerCase()}`;
    const series = seriesByGroupKey.get(groupKey);
    if (!series) {
      throw new Error(
        `Missing policy series assignment for ${item.seriesNumber}`,
      );
    }
    output[item.index] = {
      ...policy,
      policySeriesId: series.policySeriesId,
      seriesNumber: series.seriesNumber,
    };
  }

  return output as PolicySeriesImportResult<T>[];
}
