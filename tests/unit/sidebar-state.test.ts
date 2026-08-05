import { describe, expect, it } from "vitest";
import {
  resolveNavSectionsExpanded,
  resolveShellNavState,
  readNavSectionsFromCookieHeader,
  readRecentsOpenFromCookieHeader,
  readRecentsOpenFromRequest,
  readSidebarOpenFromCookieHeader,
  readSidebarOpenFromRequest,
  sectionFromPathname,
} from "~/lib/services/navigation/sidebar-state";

describe("sidebar-state", () => {
  it("defaults to open when cookie is missing", () => {
    expect(readSidebarOpenFromCookieHeader(null)).toBe(true);
    expect(
      readSidebarOpenFromRequest(new Request("https://app.test/dashboard")),
    ).toBe(true);
  });

  it("reads pinned collapsed state from cookie header", () => {
    expect(
      readSidebarOpenFromCookieHeader("sidebar_state=false; other=1"),
    ).toBe(false);
    expect(
      readSidebarOpenFromRequest(
        new Request("https://app.test/dashboard", {
          headers: { Cookie: "sidebar_state=true" },
        }),
      ),
    ).toBe(true);
  });

  it("defaults recents closed when cookie is missing", () => {
    expect(readRecentsOpenFromCookieHeader(null)).toBe(false);
    expect(
      readRecentsOpenFromRequest(new Request("https://app.test/dashboard")),
    ).toBe(false);
  });

  it("reads recents open from cookie header", () => {
    expect(readRecentsOpenFromCookieHeader("recents_open=1")).toBe(true);
    expect(readRecentsOpenFromCookieHeader("recents_open=0")).toBe(false);
  });

  it("forces sidebar open when recents are open (SSR)", () => {
    const request = new Request("https://app.test/dashboard", {
      headers: { Cookie: "recents_open=1; sidebar_state=false" },
    });
    expect(resolveShellNavState(request)).toEqual({
      recentsOpen: true,
      sidebarOpen: true,
    });
  });

  it("reads expanded nav sections from cookie", () => {
    expect(
      readNavSectionsFromCookieHeader("nav_sections=reports,settings"),
    ).toEqual(["reports", "settings"]);
    expect(readNavSectionsFromCookieHeader(null)).toEqual([]);
  });

  it("merges active path section into expanded nav sections (SSR)", () => {
    const request = new Request("https://app.test/settings/prices", {
      headers: { Cookie: "nav_sections=reports" },
    });
    expect(resolveNavSectionsExpanded(request, "/settings/prices")).toEqual([
      "reports",
      "settings",
    ]);
    expect(sectionFromPathname("/settings/prices")).toBe("settings");
  });
});
