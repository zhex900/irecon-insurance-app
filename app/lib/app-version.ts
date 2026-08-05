/**
 * App version label shown in the sidebar footer.
 *
 * Set at build time via VITE_APP_VERSION:
 * - local        → "local" (default in `npm run dev`)
 * - PR preview   → "PR-<number>"
 * - staging      → "staging-<short-commit>"
 * - production   → release tag (e.g. "v1.2.3")
 */

export type AppEnvironment = "local" | "pr" | "staging" | "prod" | "unknown";

export function getAppVersion(): string {
  const fromEnv = import.meta.env.VITE_APP_VERSION?.trim();
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV) return "local";
  return "unknown";
}

export function getAppEnvironment(version = getAppVersion()): AppEnvironment {
  const v = version.trim().toLowerCase();
  if (v === "local") return "local";
  if (/^pr[-_]?\d+/.test(v) || v.startsWith("pr-") || v.startsWith("pr/")) {
    return "pr";
  }
  if (v.startsWith("staging")) return "staging";
  if (v === "unknown") return "unknown";
  // Release tags (v1.2.3) and anything else deployed as production
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
      return "border-destructive/50 bg-destructive/25 text-destructive";
    case "staging":
      return "border-warning/50 bg-warning/25 text-warning";
    case "prod":
      return "border-success/50 bg-success/25 text-success";
    default:
      return "border-white/25 bg-white/10 text-sidebar-foreground";
  }
}
