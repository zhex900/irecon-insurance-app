import { describe, expect, it } from "vitest";

import {
  computeLeaveNavigation,
  excludeRecentRoute,
  excludeRecentRoutesForEntity,
  pushRecentRouteLocalDetailed,
  recentCaptionForPath,
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

  it("recentCaptionForPath appends (edit) for client edit sub-routes", () => {
    const clientId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    expect(recentCaptionForPath(`/clients/${clientId}`)).toBe("Client");
    expect(recentCaptionForPath(`/clients/${clientId}/edit`)).toBe(
      "Client (edit)",
    );
  });

  it("pushRecentRouteLocalDetailed includes (edit) caption for edit paths", () => {
    const clientId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const { routes } = pushRecentRouteLocalDetailed(
      [],
      `/clients/${clientId}/edit`,
    );
    expect(routes[0]?.caption).toBe("Client (edit)");
  });

  it("excludeRecentRoutesForEntity removes client detail and edit paths", () => {
    const clientId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const routes = [
      {
        id: "a",
        href: `/clients/${clientId}`,
        label: "Acme",
        caption: "Client",
      },
      {
        id: "b",
        href: `/clients/${clientId}/edit`,
        label: "Acme",
        caption: "Client (edit)",
      },
      {
        id: "c",
        href: "/policies",
        label: "Policies",
        caption: "Policies",
      },
    ];
    expect(
      excludeRecentRoutesForEntity(routes, {
        kind: "client",
        id: clientId,
      }).map((route) => route.href),
    ).toEqual(["/policies"]);
  });

  it("computeLeaveNavigation skips recording a removed entity", () => {
    const clientId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const update = computeLeaveNavigation(
      [{ id: "x", href: "/policies", label: "Policies", caption: "Policies" }],
      `/clients/${clientId}`,
      "/clients",
      [{ kind: "client", id: clientId }],
    );

    expect(update.recordPath).toBeNull();
    expect(update.enteringId).toBeNull();
    expect(update.routes.map((route) => route.href)).toEqual(["/policies"]);
  });

  it("computeLeaveNavigation records the page being left", () => {
    const update = computeLeaveNavigation([], "/clients", "/policies", []);

    expect(update.recordPath).toBe("/clients");
    expect(update.routes.map((route) => route.href)).toEqual(["/clients"]);
  });
});
