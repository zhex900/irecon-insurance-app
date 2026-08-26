import * as React from "react";

import { RECENTS_ENTER_MS } from "~/components/side-nav/utils/recents-list-height";
import {
  computeLeaveNavigation,
  consumeRemovedRecentEntities,
  excludeRecentRoute,
  type LeaveNavigationUpdate,
  normalizeRecentPath,
  readLastRecordedPath,
  RECENT_ROUTES_CHANGED_EVENT,
  writeLastRecordedPath,
} from "~/lib/services/navigation/recent-routes";
import type { SideNavLink } from "~/lib/services/navigation/side-nav.service";

type RecentRoutesState = {
  routes: SideNavLink[];
  enteringId: string | null;
  spilledRoute: SideNavLink | null;
};

type RecentRoutesAction =
  | { type: "sync"; routes: SideNavLink[]; pathname: string }
  | { type: "leave"; update: LeaveNavigationUpdate }
  | { type: "mergeLabels"; routes: SideNavLink[] }
  | { type: "clearAnimation" };

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

function recentRoutesReducer(
  state: RecentRoutesState,
  action: RecentRoutesAction,
): RecentRoutesState {
  switch (action.type) {
    case "sync":
      return {
        ...state,
        routes: excludeRecentRoute(action.routes, action.pathname),
        enteringId: null,
        spilledRoute: null,
      };
    case "leave":
      return {
        routes: action.update.routes,
        enteringId: action.update.enteringId,
        spilledRoute: action.update.spilled,
      };
    case "mergeLabels":
      return {
        ...state,
        routes: mergeRecentRouteLabels(state.routes, action.routes),
      };
    case "clearAnimation":
      return {
        ...state,
        enteringId: null,
        spilledRoute: null,
      };
    default:
      return state;
  }
}

function createInitialState(
  loaderRoutes: SideNavLink[],
  pathname: string,
): RecentRoutesState {
  return {
    routes: excludeRecentRoute(loaderRoutes, pathname),
    enteringId: null,
    spilledRoute: null,
  };
}

async function fetchRecentRoutes(): Promise<SideNavLink[] | null> {
  const response = await fetch("/api/recent-routes");
  if (!response.ok) return null;
  const payload = (await response.json()) as { routes?: SideNavLink[] };
  return Array.isArray(payload.routes) ? payload.routes : null;
}

export function useRecentRoutes(loaderRoutes: SideNavLink[], pathname: string) {
  const [state, dispatch] = React.useReducer(
    recentRoutesReducer,
    { loaderRoutes, pathname },
    ({ loaderRoutes: routes, pathname: path }) =>
      createInitialState(routes, path),
  );
  const stateRef = React.useRef(state);
  const enterClearTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const pathnameRef = React.useRef(pathname);
  const loaderRoutesKeyValue = recentRoutesKey(loaderRoutes);

  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

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
    dispatch({
      type: "sync",
      routes: loaderRoutes,
      pathname: pathnameRef.current,
    });
  }, [loaderRoutesKeyValue, loaderRoutes]);

  React.useEffect(() => {
    function refreshFromApi() {
      void fetchRecentRoutes()
        .then((routes) => {
          if (!routes) return;
          dispatch({
            type: "sync",
            routes,
            pathname: pathnameRef.current,
          });
        })
        .catch(() => {});
    }

    window.addEventListener(RECENT_ROUTES_CHANGED_EVENT, refreshFromApi);
    return () =>
      window.removeEventListener(RECENT_ROUTES_CHANGED_EVENT, refreshFromApi);
  }, []);

  React.useEffect(() => {
    const path = normalizeRecentPath(pathname);
    if (!path) return;

    const previousPath = readLastRecordedPath();
    if (previousPath === path) return;
    writeLastRecordedPath(path);

    if (!previousPath) return;

    const update = computeLeaveNavigation(
      stateRef.current.routes,
      previousPath,
      path,
      consumeRemovedRecentEntities(),
    );

    dispatch({ type: "leave", update });

    if (update.enteringId) {
      if (enterClearTimerRef.current !== null) {
        clearTimeout(enterClearTimerRef.current);
      }
      enterClearTimerRef.current = setTimeout(() => {
        dispatch({ type: "clearAnimation" });
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
        if (pathnameRef.current !== path) return;
        if (apiRoutes[0]?.href !== update.recordPath) return;
        dispatch({ type: "mergeLabels", routes: apiRoutes });
      })
      .catch(() => {});
  }, [pathname]);

  return {
    recentRoutes: state.routes,
    enteringId: state.enteringId,
    spilledRoute: state.spilledRoute,
  };
}
