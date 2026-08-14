// Shared authentication utilities (legacy - token validation removed)

export interface WorkerEnv {
  WORKER_SHARED_SECRET?: string;
  APP_URL?: string;
  [key: string]: unknown;
}

/**
 * Log security event for monitoring
 */
export function logSecurityEvent(
  eventType: string,
  request: Request,
  details?: Record<string, unknown>,
): void {
  console.warn(
    JSON.stringify({
      event: `security.${eventType}`,
      timestamp: new Date().toISOString(),
      path: new URL(request.url).pathname,
      method: request.method,
      ip: request.headers.get("CF-Connecting-IP"),
      ...details,
    }),
  );
}
