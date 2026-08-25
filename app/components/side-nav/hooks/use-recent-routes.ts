import * as React from "react";

import { RECENTS_ENTER_MS } from "~/components/side-nav/utils/recents-list-height";
import {
  computeLeaveNavigation,
  consumeRemovedRecentEntities,
  excludeRecentRoute,
  normalizeRecentPath,
  RECENT_ROUTES_CHANGED_EVENT,
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

function recentRoutesKey(routes: SideNavLink[]): string {
  return routes.map((route) => route.href).join("|");
}

function visibleRecentRoutes(
  routes: SideNavLink[],
  pathname: string,
): SideNavLink[] {
  return excludeRecentRoute(routes, pathname);
}

async function fetchRecentRoutes(): Promise<SideNavLink[] | null> {
  const response = await fetch("/api/recent-routes");
  if (!response.ok) return null;
  const payload = (await response.json()) as { routes?: SideNavLink[] };
  return Array.isArray(payload.routes) ? payload.routes : null;
}

export function useRecentRoutes(loaderRoutes: SideNavLink[], pathname: string) {
  const initialRecentRoutes = visibleRecentRoutes(loaderRoutes, pathname);
  const lastRecordedPathRef = React.useRef("");
  const recentRoutesRef = React.useRef(initialRecentRoutes);
  const skipInitialPathEffectRef = React.useRef(true);
  const enterClearTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const loaderRoutesKeyValue = recentRoutesKey(loaderRoutes);
  const pathnameRef = React.useRef(pathname);

  const [recentRoutes, setRecentRoutes] = React.useState(initialRecentRoutes);
  const [enteringId, setEnteringId] = React.useState<string | null>(null);
  const [spilledRoute, setSpilledRoute] = React.useState<SideNavLink | null>(
    null,
  );

  const applyVisibleRoutes = React.useCallback(
    (routes: SideNavLink[]) => {
      setRecentRoutes(visibleRecentRoutes(routes, pathnameRef.current));
    },
    [],
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
    pathnameRef.current = pathname;
  }, [pathname]);

  // Shell loader refetches after delete — apply fresh Recents from the server.
  React.useEffect(() => {
    applyVisibleRoutes(loaderRoutes);
  }, [applyVisibleRoutes, loaderRoutesKeyValue]);

  React.useEffect(() => {
    function refreshFromApi() {
      void fetchRecentRoutes()
        .then((routes) => {
          if (routes) applyVisibleRoutes(routes);
        })
        .catch(() => {});
    }

    window.addEventListener(RECENT_ROUTES_CHANGED_EVENT, refreshFromApi);
    return () =>
      window.removeEventListener(RECENT_ROUTES_CHANGED_EVENT, refreshFromApi);
  }, [applyVisibleRoutes]);

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

    if (!previousPath) return;

    const update = computeLeaveNavigation(
      recentRoutesRef.current,
      previousPath,
      path,
      consumeRemovedRecentEntities(),
    );

    setRecentRoutes(update.routes);
    setSpilledRoute(update.spilled);
    setEnteringId(update.enteringId);

    if (update.enteringId) {
      if (enterClearTimerRef.current !== null) {
        clearTimeout(enterClearTimerRef.current);
      }
      enterClearTimerRef.current = setTimeout(() => {
        setEnteringId(null);
        setSpilledRoute(null);
        enterClearTimerRef.current = null;
      }, RECENTS_ENTER_MS + 40);
    }

    if (!update.recordPath) return;

    const formData = new FormData();
    formData.set("path", update.recordPath);
    void fetch("/api/recent-routes", {
      method: "POST",
      body: formData,
      keepalive: true,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as { routes?: SideNavLink[] };
        const apiRoutes = payload.routes;
        if (!apiRoutes?.length) return;
        if (lastRecordedPathRef.current !== path) return;
        if (apiRoutes[0]?.href !== update.recordPath) return;
        setRecentRoutes((prev) => mergeRecentRouteLabels(prev, apiRoutes));
      })
      .catch(() => {});
  }, [pathname]);

  return { recentRoutes, enteringId, spilledRoute };
}
