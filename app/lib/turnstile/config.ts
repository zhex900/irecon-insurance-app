/** Public Turnstile site key (Vite build-time). */
export function readTurnstileSiteKey(): string | undefined {
  const fromVite = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();
  if (fromVite) return fromVite;
  if (typeof process !== "undefined") {
    return process.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? undefined;
  }
  return undefined;
}

/** Server-only secret — set via Worker secret / `.env` for local dev. */
export function readTurnstileSecretKey(): string | undefined {
  return process.env.TURNSTILE_SECRET_KEY?.trim() ?? undefined;
}

/** Turnstile is active only when both site key and secret are configured. */
export function isTurnstileEnabled(): boolean {
  return Boolean(readTurnstileSiteKey() && readTurnstileSecretKey());
}
