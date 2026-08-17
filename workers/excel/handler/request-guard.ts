/**
 * Shared RPC request limits. Measure size only — never put the JSON in a body.
 */

export function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

export function isPayloadTooLarge(value: unknown, maxBytes: number): boolean {
  try {
    const json = JSON.stringify(value);
    if (typeof json !== "string") return false;
    return new TextEncoder().encode(json).byteLength > maxBytes;
  } catch {
    return false;
  }
}

export class RequestTimeoutError extends Error {
  override name = "RequestTimeoutError";
  constructor() {
    super("Request timed out");
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RequestTimeoutError()), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
