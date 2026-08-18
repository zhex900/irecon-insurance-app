function required(name: string, value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(
      `${name} is not set. Add it to .env (local: supabase status -o env).`,
    );
  }
  return trimmed;
}

export function getSupabaseUrl() {
  return required("SUPABASE_URL", process.env.SUPABASE_URL);
}

export function getSupabasePublishableKey() {
  return required(
    "SUPABASE_PUBLISHABLE_KEY",
    process.env.SUPABASE_PUBLISHABLE_KEY,
  );
}

export function getSupabaseSecretKey() {
  return required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);
}

/**
 * Public app origin for auth emails / redirects.
 * Prefer APP_URL on staging/prod so reset links don't depend on request host.
 */
export function getAppOrigin(request?: Request) {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  if (request) return new URL(request.url).origin;
  throw new Error(
    "APP_URL is not set and no request was provided to derive the origin.",
  );
}
