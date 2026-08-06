import { z } from "zod";

export const queryTextSchema = z.string().trim().max(200).catch("");
export const optionalIsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);
export const positiveIntegerSchema = z.coerce.number().int().positive();
/** Route / API ids for client + policy (UUID primary keys). */
export const uuidParamSchema = z.string().uuid();
export const booleanFlagSchema = z.enum(["0", "1"]).catch("0");

export function searchParamsObject(request: Request): Record<string, string> {
  return Object.fromEntries(new URL(request.url).searchParams);
}

export function parsePositiveInteger(value: unknown): number | undefined {
  const parsed = positiveIntegerSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function parseUuid(value: unknown): string | undefined {
  const parsed = uuidParamSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function formDataObject(
  formData: FormData,
): Record<string, FormDataEntryValue> {
  return Object.fromEntries(formData);
}

export function parseFormIntent<const T extends readonly [string, ...string[]]>(
  formData: FormData,
  allowed: T,
  fallback?: T[number],
): T[number] | undefined {
  const value = formData.get("intent") ?? fallback;
  const parsed = z.enum(allowed).safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function invalidInputResponse(message = "Invalid request data.") {
  return Response.json(
    { ok: false as const, formError: message },
    { status: 400 },
  );
}
