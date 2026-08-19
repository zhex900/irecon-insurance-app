/**
 * Shared session lifetime evaluation (safe for client + server).
 *
 * Env is read only on the server via `session-timeout.server.ts`.
 */

export type SessionTimeoutConfig = {
  /** Idle limit before forced re-login. 0 = disabled. */
  inactivityMs: number;
  /** Max wall-clock session lifetime from login. 0 = disabled. */
  absoluteMs: number;
  /** Min gap between rewriting the last-activity cookie. */
  activityRefreshMs: number;
};

export type SessionTiming = {
  startedAtMs: number | null;
  lastActivityAtMs: number | null;
};

export type SessionTimeoutVerdict =
  | { ok: true; shouldRefreshActivity: boolean; nowMs: number }
  | { ok: false; reason: "inactivity" | "absolute"; nowMs: number };

/** Client payload from the app layout loader (no secrets). */
export type SessionTimeoutClientState = {
  inactivityMs: number;
  absoluteMs: number;
  startedAtMs: number;
  lastActivityAtMs: number;
  /** Server Date.now() when the loader ran — for clock skew. */
  serverNowMs: number;
};

/**
 * Decide whether the app session is still valid and whether to bump activity.
 * Missing timing cookies are treated as a fresh session (grace for pre-deploy logins).
 */
export function evaluateSessionTimeout(
  timing: SessionTiming,
  config: Pick<
    SessionTimeoutConfig,
    "inactivityMs" | "absoluteMs" | "activityRefreshMs"
  >,
  nowMs = Date.now(),
): SessionTimeoutVerdict {
  const startedAtMs = timing.startedAtMs ?? nowMs;
  const lastActivityAtMs = timing.lastActivityAtMs ?? startedAtMs;

  if (config.absoluteMs > 0 && nowMs - startedAtMs >= config.absoluteMs) {
    return { ok: false, reason: "absolute", nowMs };
  }

  if (
    config.inactivityMs > 0 &&
    nowMs - lastActivityAtMs >= config.inactivityMs
  ) {
    return { ok: false, reason: "inactivity", nowMs };
  }

  const shouldRefreshActivity =
    timing.startedAtMs == null ||
    timing.lastActivityAtMs == null ||
    nowMs - lastActivityAtMs >= config.activityRefreshMs;

  return { ok: true, shouldRefreshActivity, nowMs };
}
