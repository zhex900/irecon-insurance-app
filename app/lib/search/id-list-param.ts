import { z } from "zod";

const positiveIdSchema = z.coerce.number().int().positive();
const uuidIdSchema = z.string().uuid();

/** Parse comma-separated positive int IDs from a URL search param. */
export function parseIdListParam(value: string | null): number[] {
  if (!value?.trim() || value.length > 10_000) return [];
  const ids = value
    .split(",")
    .slice(0, 500)
    .map((part) => positiveIdSchema.safeParse(part.trim()))
    .filter((result) => result.success)
    .map((result) => result.data);
  return [...new Set(ids)];
}

/** Parse comma-separated UUID IDs (client / policy keys) from a URL search param. */
export function parseUuidListParam(value: string | null): string[] {
  if (!value?.trim() || value.length > 10_000) return [];
  const ids = value
    .split(",")
    .slice(0, 500)
    .map((part) => uuidIdSchema.safeParse(part.trim()))
    .filter((result) => result.success)
    .map((result) => result.data);
  return [...new Set(ids)];
}

export function formatIdListParam(ids: Array<number | string>): string | null {
  if (ids.length === 0) return null;
  return ids.join(",");
}
