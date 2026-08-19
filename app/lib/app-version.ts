/**
 * App version label shown in the sidebar footer.
 *
 * Set at build time:
 * - VITE_APP_VERSION — env label (pr-1, uat, …)
 * - VITE_APP_COMMIT   — short git SHA
 *
 * Sidebar badge shows the release (e.g. pr-1-abc1234); click copies the commit.
 */

export type AppEnvironment = "local" | "pr" | "uat" | "prod" | "unknown";

export function getAppVersion(): string {
  const fromEnv = import.meta.env.VITE_APP_VERSION?.trim();
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV) return "local";
  return "unknown";
}

export function getAppCommit(): string | undefined {
  const commit = import.meta.env.VITE_APP_COMMIT?.trim();
  return commit || undefined;
}

/** Full release id for Sentry, caches, etc. (e.g. pr-1-a1b2c3d, uat-a1b2c3d). */
export function getAppRelease(): string {
  const version = getAppVersion();
  const commit = getAppCommit();
  if (commit && version !== "local" && version !== "unknown") {
    return `${version}-${commit}`;
  }
  return version;
}

export function getAppEnvironment(version = getAppVersion()): AppEnvironment {
  const v = version.trim().toLowerCase();
  if (v === "local") return "local";
  if (/^pr[-_]?\d+/.test(v) || v.startsWith("pr-") || v.startsWith("pr/")) {
    return "pr";
  }
  if (v.startsWith("uat") || v.startsWith("staging")) return "uat";
  if (v === "unknown") return "unknown";
  return "prod";
}

/**
 * Tailwind classes for the environment badge.
 * Sidebar is always dark — use light text / bright accents for contrast.
 */
export function getAppEnvironmentBadgeClass(env: AppEnvironment): string {
  switch (env) {
    case "local":
      return "border-sidebar-border bg-sidebar-accent text-sidebar-foreground";
    case "pr":
      return "border-focus/50 bg-focus/25 text-focus";
    case "uat":
      return "border-warning/50 bg-warning/25 text-warning";
    case "prod":
      return "border-success/50 bg-success/25 text-success";
    default:
      return "border-white/25 bg-white/10 text-sidebar-foreground";
  }
}
