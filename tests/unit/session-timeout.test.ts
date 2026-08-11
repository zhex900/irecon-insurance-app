import { describe, expect, it } from "vitest";
import {
  evaluateSessionTimeout,
  readSessionTimeoutConfig,
} from "~/lib/auth/session-timeout.server";

describe("readSessionTimeoutConfig", () => {
  it("uses defaults when env is empty", () => {
    const config = readSessionTimeoutConfig({});
    expect(config.inactivityMs).toBe(30 * 60_000);
    expect(config.absoluteMs).toBe(12 * 3_600_000);
  });

  it("honours zero to disable a limit", () => {
    const config = readSessionTimeoutConfig({
      SESSION_INACTIVITY_TIMEOUT_MINUTES: "0",
      SESSION_ABSOLUTE_TIMEOUT_HOURS: "0",
    });
    expect(config.inactivityMs).toBe(0);
    expect(config.absoluteMs).toBe(0);
  });

  it("parses custom values", () => {
    const config = readSessionTimeoutConfig({
      SESSION_INACTIVITY_TIMEOUT_MINUTES: "15",
      SESSION_ABSOLUTE_TIMEOUT_HOURS: "8",
    });
    expect(config.inactivityMs).toBe(15 * 60_000);
    expect(config.absoluteMs).toBe(8 * 3_600_000);
  });
});

describe("evaluateSessionTimeout", () => {
  const config = {
    inactivityMs: 30 * 60_000,
    absoluteMs: 12 * 3_600_000,
    activityRefreshMs: 60_000,
  };

  it("accepts a fresh session and asks to refresh activity cookies", () => {
    const now = Date.UTC(2026, 7, 11, 12, 0, 0);
    const verdict = evaluateSessionTimeout(
      { startedAtMs: null, lastActivityAtMs: null },
      config,
      now,
    );
    expect(verdict).toEqual({
      ok: true,
      shouldRefreshActivity: true,
      nowMs: now,
    });
  });

  it("ends session after inactivity", () => {
    const now = Date.UTC(2026, 7, 11, 12, 0, 0);
    const started = now - 10 * 60_000;
    const lastActivity = now - 31 * 60_000;
    const verdict = evaluateSessionTimeout(
      { startedAtMs: started, lastActivityAtMs: lastActivity },
      config,
      now,
    );
    expect(verdict).toEqual({ ok: false, reason: "inactivity", nowMs: now });
  });

  it("ends session after absolute max", () => {
    const now = Date.UTC(2026, 7, 11, 12, 0, 0);
    const started = now - 13 * 3_600_000;
    const verdict = evaluateSessionTimeout(
      { startedAtMs: started, lastActivityAtMs: now - 60_000 },
      config,
      now,
    );
    expect(verdict).toEqual({ ok: false, reason: "absolute", nowMs: now });
  });

  it("keeps session when within both limits", () => {
    const now = Date.UTC(2026, 7, 11, 12, 0, 0);
    const started = now - 2 * 3_600_000;
    const lastActivity = now - 5 * 60_000;
    const verdict = evaluateSessionTimeout(
      { startedAtMs: started, lastActivityAtMs: lastActivity },
      config,
      now,
    );
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.shouldRefreshActivity).toBe(true);
    }
  });

  it("skips activity refresh when recently bumped", () => {
    const now = Date.UTC(2026, 7, 11, 12, 0, 0);
    const started = now - 2 * 3_600_000;
    const lastActivity = now - 30_000;
    const verdict = evaluateSessionTimeout(
      { startedAtMs: started, lastActivityAtMs: lastActivity },
      config,
      now,
    );
    expect(verdict).toEqual({
      ok: true,
      shouldRefreshActivity: false,
      nowMs: now,
    });
  });
});
