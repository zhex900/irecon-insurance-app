import { Link, type LinkProps } from "react-router";

/**
 * In-app link with eager route discovery disabled. React Router batches
 * `discover="render"` links into `/__manifest` requests on mount and again
 * from a MutationObserver before the first completes, causing duplicates.
 * Routes are still discovered lazily on navigation.
 */
export function AppLink({ discover = "none", ...props }: LinkProps) {
  return <Link discover={discover} {...props} />;
}
