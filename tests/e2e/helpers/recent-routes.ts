import { expect, type Page, type Response } from "@playwright/test";

export type RecentRouteEntry = {
  href: string;
  label: string;
};

export type RecentNavStep =
  | {
      action: "goto";
      path: string;
      heading?: RegExp;
      waitForReferenceList?: boolean;
    }
  | {
      action: "sidebar";
      path: "/clients" | "/policies" | "/reports" | "/dashboard";
      expectPost?: boolean;
    }
  | {
      action: "clientRow";
      index?: number;
      expectPost?: boolean;
    }
  | {
      action: "link";
      name: string | RegExp;
      exact?: boolean;
      url?: RegExp;
      expectPost?: boolean;
    };

function shellCookieUrl(): string {
  return process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173";
}

function appNav(page: Page) {
  return page.getByRole("navigation", { name: "App" });
}

function recentsNav(page: Page) {
  return page.getByRole("navigation", { name: "Recents" });
}

function pathUrlPattern(path: string): RegExp {
  return new RegExp(
    `${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[/?#]|$)`,
  );
}

function waitForRecentRoutePush(page: Page): Promise<Response> {
  return page.waitForResponse(
    (response) =>
      response.url().includes("/api/recent-routes") &&
      response.request().method() === "POST",
  );
}

async function assertRecentRoutePush(response: Response) {
  expect(
    response.ok(),
    `POST /api/recent-routes failed: ${response.status()} ${await response.text().catch(() => "")}`,
  ).toBeTruthy();
}

async function openRecentsSection(page: Page) {
  const toggle = recentsNav(page).getByRole("button", { name: "Recents" });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
}

async function waitForAppShell(page: Page) {
  await expect(appNav(page)).toBeVisible();
}

async function navigateInApp(page: Page, path: string) {
  if (path === "/reports") {
    const reports = appNav(page).getByRole("button", { name: "Reports" });
    if ((await reports.getAttribute("aria-expanded")) !== "true") {
      await reports.click();
    }
    await reports.click();
    return;
  }

  const label = {
    "/clients": "Clients",
    "/policies": "Policies",
    "/dashboard": "Dashboard",
  }[path];
  if (!label) {
    throw new Error(`navigateInApp: unsupported path "${path}"`);
  }

  await appNav(page).getByRole("button", { name: label, exact: true }).click();
}

async function performRecentNavStep(page: Page, step: RecentNavStep) {
  const expectPost = step.action === "goto" ? false : (step.expectPost ?? true);
  const pushPromise = expectPost ? waitForRecentRoutePush(page) : null;

  switch (step.action) {
    case "goto": {
      const referenceListPromise = step.waitForReferenceList
        ? page.waitForResponse("**/api/reference/list.data**")
        : null;
      await page.goto(step.path);
      if (step.heading) {
        await expect(
          page.getByRole("heading", { name: step.heading }).first(),
        ).toBeVisible();
      }
      if (referenceListPromise) await referenceListPromise;
      await waitForAppShell(page);
      break;
    }
    case "sidebar": {
      await waitForAppShell(page);
      const urlPromise = page.waitForURL(pathUrlPattern(step.path));
      await navigateInApp(page, step.path);
      await urlPromise;
      break;
    }
    case "clientRow": {
      const row = page
        .getByRole("row", { name: /^open client/i })
        .nth(step.index ?? 0);
      await expect(row).toBeVisible();
      const urlPromise = page.waitForURL(/\/clients\/[^/]+$/);
      await row.click();
      await urlPromise;
      break;
    }
    case "link": {
      const link = page.getByRole("link", {
        name: step.name,
        exact: step.exact,
      });
      if (step.url) {
        const urlPromise = page.waitForURL(step.url);
        await link.click();
        await urlPromise;
      } else {
        await link.click();
      }
      break;
    }
    default: {
      const _exhaustive: never = step;
      throw new Error(
        `Unknown navigation step: ${JSON.stringify(_exhaustive)}`,
      );
    }
  }

  if (pushPromise) {
    await assertRecentRoutePush(await pushPromise);
  }
}

/** Keep Recents expanded for stable sidebar assertions. */
export async function prepareRecentsShell(page: Page) {
  await page.context().addCookies([
    { name: "recents_open", value: "1", url: shellCookieUrl() },
    { name: "sidebar_state", value: "true", url: shellCookieUrl() },
  ]);
}

/** Clear server + sessionStorage Recents before each test. */
export async function clearRecentRoutes(page: Page) {
  await page.addInitScript(() => {
    try {
      sessionStorage.removeItem("irecon:recent-routes:last-path");
    } catch {
      // Private browsing / disabled storage.
    }
  });

  const response = await page.request.delete("/api/recent-routes");
  expect(response.ok()).toBeTruthy();
}

/** Recents labels in sidebar order (most recent first). Current page is excluded. */
export async function getRecentRouteLabels(page: Page): Promise<string[]> {
  await openRecentsSection(page);
  const rows = recentsNav(page).locator("ul > li");
  const count = await rows.count();
  const labels: string[] = [];

  for (let i = 0; i < count; i++) {
    const label = (
      await rows.nth(i).locator("span.block.truncate").first().textContent()
    )?.trim();
    if (label) labels.push(label);
  }

  return labels;
}

/** Label a client directory row will use in Recents. */
export async function getClientDirectoryLabel(
  page: Page,
  index = 0,
): Promise<string> {
  const row = page.getByRole("row", { name: /^open client/i }).nth(index);
  await expect(row).toBeVisible();
  const visible = (
    await row.locator("p.font-medium").first().textContent()
  )?.trim();
  if (visible && visible !== "—") return visible;
  return "Client";
}

const RECENT_ROUTES_API_TIMEOUT_MS = process.env.CI ? 45_000 : 15_000;

export async function fetchRecentRoutesFromApi(
  page: Page,
): Promise<RecentRouteEntry[]> {
  const response = await page.request.get("/api/recent-routes", {
    timeout: RECENT_ROUTES_API_TIMEOUT_MS,
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { routes?: RecentRouteEntry[] };
  return payload.routes ?? [];
}

/** Run in-app navigations; waits for POST /api/recent-routes when leaving a page. */
export async function navigateRecentRoutes(page: Page, steps: RecentNavStep[]) {
  for (const step of steps) {
    await performRecentNavStep(page, step);
  }
}

export async function clickRecentRoute(
  page: Page,
  label: string | RegExp,
  options?: { url?: RegExp | string },
) {
  await openRecentsSection(page);
  const urlPromise = options?.url ? page.waitForURL(options.url) : null;
  await recentsNav(page).getByRole("button", { name: label }).click();
  if (urlPromise) await urlPromise;
}
