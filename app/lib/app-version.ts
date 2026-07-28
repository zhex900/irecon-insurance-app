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

/** Tailwind classes for the environment badge (works on light + dark sidebars). */
export function getAppEnvironmentBadgeClass(env: AppEnvironment): string {
  switch (env) {
    case "local":
      return "border-info/30 bg-info/15 text-info-foreground";
    case "pr":
      return "border-primary/30 bg-primary/15 text-primary";
    case "staging":
      return "border-warning/30 bg-warning/15 text-warning-foreground";
    case "prod":
      return "border-success/30 bg-success/15 text-success-foreground";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}
