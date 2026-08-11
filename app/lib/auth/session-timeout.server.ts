/**
 * App-level session lifetime (no Supabase Pro required).
 *
 * Env (minutes / hours; 0 disables that limit):
 * - SESSION_INACTIVITY_TIMEOUT_MINUTES (default 30)
 * - SESSION_ABSOLUTE_TIMEOUT_HOURS (default 12)
 */
import {
  evaluateSessionTimeout,
  type SessionTimeoutConfig,
  type SessionTimeoutClientState,
  type SessionTiming,
  type SessionTimeoutVerdict,
} from "~/lib/auth/session-timeout";
import { readSessionTiming } from "~/lib/supabase/auth.server";

export type {
  SessionTimeoutConfig,
  SessionTimeoutClientState,
  SessionTiming,
  SessionTimeoutVerdict,
};
export { evaluateSessionTimeout };

const DEFAULT_INACTIVITY_MINUTES = 30;
const DEFAULT_ABSOLUTE_HOURS = 12;
/** Avoid Set-Cookie on every navigation. */
const ACTIVITY_REFRESH_MS = 60_000;

function parsePositiveNumber(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function readSessionTimeoutConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): SessionTimeoutConfig {
  const inactivityMinutes =
    parsePositiveNumber(env.SESSION_INACTIVITY_TIMEOUT_MINUTES) ??
    DEFAULT_INACTIVITY_MINUTES;
  const absoluteHours =
    parsePositiveNumber(env.SESSION_ABSOLUTE_TIMEOUT_HOURS) ??
    DEFAULT_ABSOLUTE_HOURS;

  return {
    inactivityMs: inactivityMinutes * 60_000,
    absoluteMs: absoluteHours * 3_600_000,
    activityRefreshMs: ACTIVITY_REFRESH_MS,
  };
}

/** Payload for the client session-timeout dialog (null when both limits disabled). */
export function getSessionTimeoutClientState(
  request: Request,
  nowMs = Date.now(),
): SessionTimeoutClientState | null {
  const config = readSessionTimeoutConfig();
  if (config.inactivityMs <= 0 && config.absoluteMs <= 0) return null;

  const timing = readSessionTiming(request);
  const startedAtMs = timing.startedAtMs ?? nowMs;
  const lastActivityAtMs = timing.lastActivityAtMs ?? startedAtMs;

  return {
    inactivityMs: config.inactivityMs,
    absoluteMs: config.absoluteMs,
    startedAtMs,
    lastActivityAtMs,
    serverNowMs: nowMs,
  };
}
