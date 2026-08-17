import { describe, expect, it } from "vitest";

import {
  excludeRecentRoute,
  pushRecentRouteLocalDetailed,
} from "~/lib/services/navigation/recent-routes";

describe("recent route ordering", () => {
  it("excludeRecentRoute removes the active path", () => {
    const routes = [
      { id: "a", href: "/clients", label: "Clients", caption: "Clients" },
      {
        id: "b",
        href: "/policies",
        label: "Policies",
        caption: "Policies",
      },
    ];
    expect(excludeRecentRoute(routes, "/clients")).toEqual([routes[1]]);
  });

  it("promotes the page being left when navigating away", () => {
    const onPolicyA = excludeRecentRoute(
      [
        {
          id: "a",
          href: "/policies/a",
          label: "Policy A",
          caption: "Policy",
        },
        {
          id: "b",
          href: "/policies/b",
          label: "Policy B",
          caption: "Policy",
        },
        {
          id: "c",
          href: "/clients/c",
          label: "Client C",
          caption: "Client",
        },
      ],
      "/policies/a",
    );
    expect(onPolicyA.map((route) => route.href)).toEqual([
      "/policies/b",
      "/clients/c",
    ]);

    const leavingAForB = pushRecentRouteLocalDetailed(
      excludeRecentRoute(onPolicyA, "/policies/b"),
      "/policies/a",
    ).routes;

    expect(leavingAForB.map((route) => route.href)).toEqual([
      "/policies/a",
      "/clients/c",
    ]);
  });

  it("preserves visit order across multiple hops", () => {
    let visible = excludeRecentRoute(
      [
        {
          id: "a",
          href: "/policies/a",
          label: "Policy A",
          caption: "Policy",
        },
        {
          id: "b",
          href: "/policies/b",
          label: "Policy B",
          caption: "Policy",
        },
        {
          id: "c",
          href: "/clients/c",
          label: "Client C",
          caption: "Client",
        },
      ],
      "/policies/a",
    );

    visible = pushRecentRouteLocalDetailed(
      excludeRecentRoute(visible, "/policies/b"),
      "/policies/a",
    ).routes;
    expect(visible.map((route) => route.href)).toEqual([
      "/policies/a",
      "/clients/c",
    ]);

    visible = pushRecentRouteLocalDetailed(
      excludeRecentRoute(visible, "/clients/c"),
      "/policies/b",
    ).routes;
    expect(visible.map((route) => route.href)).toEqual([
      "/policies/b",
      "/policies/a",
    ]);
  });
});
