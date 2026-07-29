/**
 * Product branding — single source for UI copy, document titles, and emails.
 * Change here; do not scatter the product name across routes.
 */
export const APP_NAME = "Irecon Insurance";

/** Browser tab title: `"Dashboard | Irecon Insurance"` or just the product name. */
export function pageTitle(page?: string): string {
  const label = page?.trim();
  if (!label) return APP_NAME;
  return `${label} | ${APP_NAME}`;
}
