import * as React from "react";

import { RECENTS_ENTER_MS } from "~/components/side-nav/utils/recents-list-height";
import {
  excludeRecentRoute,
  normalizeRecentPath,
  pushRecentRouteLocalDetailed,
  recentIdForPath,
} from "~/lib/services/navigation/recent-routes";
import type { SideNavLink } from "~/lib/services/navigation/side-nav.service";

function mergeRecentRouteLabels(
  current: SideNavLink[],
  fromApi: SideNavLink[],
): SideNavLink[] {
  return current.map((route) => {
    const updated = fromApi.find((item) => item.href === route.href);
    if (!updated) return route;
    return {
      ...route,
      label: updated.label,
      caption: updated.caption,
    };
  });
}

export function useRecentRoutes(loaderRoutes: SideNavLink[], pathname: string) {
  const initialRecentRoutes = excludeRecentRoute(loaderRoutes, pathname);
  const lastRecordedPathRef = React.useRef("");
  const recentRoutesRef = React.useRef(initialRecentRoutes);
  const skipInitialPathEffectRef = React.useRef(true);
  const enterClearTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const [recentRoutes, setRecentRoutes] = React.useState(initialRecentRoutes);
  const [enteringId, setEnteringId] = React.useState<string | null>(null);
  const [spilledRoute, setSpilledRoute] = React.useState<SideNavLink | null>(
    null,
  );

  React.useEffect(() => {
    recentRoutesRef.current = recentRoutes;
  }, [recentRoutes]);

  React.useEffect(
    () => () => {
      if (enterClearTimerRef.current !== null) {
        clearTimeout(enterClearTimerRef.current);
      }
    },
    [],
  );

  React.useEffect(() => {
    const path = normalizeRecentPath(pathname);
    if (!path) return;

    if (skipInitialPathEffectRef.current) {
      skipInitialPathEffectRef.current = false;
      lastRecordedPathRef.current = path;
      return;
    }

    if (lastRecordedPathRef.current === path) return;
    const previousPath = lastRecordedPathRef.current;
    lastRecordedPathRef.current = path;

    if (previousPath) {
      const recordPath = normalizeRecentPath(previousPath);
      const base = excludeRecentRoute(recentRoutesRef.current, path);
      const { routes, spilled } = pushRecentRouteLocalDetailed(
        base,
        previousPath,
      );
      setRecentRoutes(routes);
      setSpilledRoute(spilled);
      setEnteringId(recentIdForPath(previousPath));
      if (enterClearTimerRef.current !== null) {
        clearTimeout(enterClearTimerRef.current);
      }
      enterClearTimerRef.current = setTimeout(() => {
        setEnteringId(null);
        setSpilledRoute(null);
        enterClearTimerRef.current = null;
      }, RECENTS_ENTER_MS + 40);

      if (recordPath) {
        const formData = new FormData();
        formData.set("path", recordPath);
        void fetch("/api/recent-routes", {
          method: "POST",
          body: formData,
          keepalive: true,
        })
          .then(async (response) => {
            if (!response.ok) return;
            const payload = (await response.json()) as {
              routes?: SideNavLink[];
            };
            const apiRoutes = payload.routes;
            if (!apiRoutes?.length) return;
            if (lastRecordedPathRef.current !== path) return;
            if (apiRoutes[0]?.href !== recordPath) return;
            // Merge refreshed labels only — optimistic stack order is authoritative.
            setRecentRoutes((prev) => mergeRecentRouteLabels(prev, apiRoutes));
          })
          .catch(() => {
            // Ignore network errors; optimistic list already updated.
          });
      }
    }
  }, [pathname]);

  return { recentRoutes, enteringId, spilledRoute };
}
