import { createContext } from "react-router";

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
  HYPERDRIVE?: { connectionString: string };
  AVATARS?: R2BucketLike;
  LIBRARY_DOCUMENTS?: R2BucketLike;
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
