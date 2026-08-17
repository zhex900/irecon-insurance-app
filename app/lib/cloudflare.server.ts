import { createContext } from "react-router";

import type { ExcelWorkerBinding } from "~/lib/excel/excel-worker.server";
import type { PdfWorkerBinding } from "~/lib/pdf/pdf-worker.server";

export type R2BucketLike = {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | string | Blob | null,
    options?: {
      httpMetadata?: { contentType?: string; cacheControl?: string };
    },
  ): Promise<unknown>;
  get(key: string): Promise<{
    body: ReadableStream | null;
    httpMetadata?: { contentType?: string };
    writeHttpMetadata?: (headers: Headers) => void;
  } | null>;
  delete(key: string): Promise<void>;
};

/** @deprecated Prefer R2BucketLike — kept for existing avatar call sites. */
export type AvatarsBucket = R2BucketLike;

export type CloudflareEnv = {
  DATABASE_URL?: string;
  APP_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_REPLY_TO?: string;
  /** Sentry DSN for Worker / SSR error reporting (secret). */
  SENTRY_DSN?: string;
  /** Cloudflare Turnstile secret for login siteverify (secret). */
  TURNSTILE_SECRET_KEY?: string;
  /** Idle minutes before forced re-login (0 disables). Default 30. */
  SESSION_INACTIVITY_TIMEOUT_MINUTES?: string;
  /** Max hours from login before forced re-login (0 disables). Default 12. */
  SESSION_ABSOLUTE_TIMEOUT_HOURS?: string;
  /** Shared secret for internal service authentication */
  WORKER_SHARED_SECRET?: string;
  HYPERDRIVE?: { connectionString: string };
  AVATARS?: R2BucketLike;
  LIBRARY_DOCUMENTS?: R2BucketLike;
  PDF_SERVICE?: PdfWorkerBinding;
  EXCEL_SERVICE?: ExcelWorkerBinding;
  SESSIONS?: {
    get: (key: string, type: "json") => Promise<unknown>;
  };
};

export const cloudflareContext = createContext<{
  env: CloudflareEnv;
  ctx: unknown;
}>();

type CloudflareRouterContext = {
  get: (key: typeof cloudflareContext) => { env: CloudflareEnv } | undefined;
};

function getR2Bucket(
  context: CloudflareRouterContext,
  name: keyof Pick<CloudflareEnv, "AVATARS" | "LIBRARY_DOCUMENTS">,
): R2BucketLike | null {
  try {
    return context.get(cloudflareContext)?.env[name] ?? null;
  } catch {
    return null;
  }
}

export function getAvatarsBucket(
  context: CloudflareRouterContext,
): R2BucketLike | null {
  return getR2Bucket(context, "AVATARS");
}

export function getLibraryDocumentsBucket(
  context: CloudflareRouterContext,
): R2BucketLike | null {
  return getR2Bucket(context, "LIBRARY_DOCUMENTS");
}

export function getPdfService(
  context: CloudflareRouterContext,
): PdfWorkerBinding | null {
  try {
    return context.get(cloudflareContext)?.env.PDF_SERVICE ?? null;
  } catch {
    return null;
  }
}

export function getExcelService(
  context: CloudflareRouterContext,
): ExcelWorkerBinding | null {
  try {
    return context.get(cloudflareContext)?.env.EXCEL_SERVICE ?? null;
  } catch {
    return null;
  }
}
