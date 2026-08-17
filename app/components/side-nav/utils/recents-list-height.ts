import type { SideNavLink } from "~/lib/services/navigation/side-nav.service";

/** Recents row with label + caption. */
export const RECENT_ROW_PX = 48;
/** Empty-state line when there are no recents. */
export const RECENT_EMPTY_PX = 32;
export const RECENTS_ENTER_MS = 320;

export function recentsListHeightPx(routes: SideNavLink[]): number {
  if (routes.length === 0) return RECENT_EMPTY_PX;
  return routes.length * RECENT_ROW_PX;
}
