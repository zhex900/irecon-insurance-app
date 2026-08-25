import { expect, type Page } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173";

export type RecentRouteEntry = {
  href: string;
  label: string;
  caption: string;
};

/** Keep the sidebar expanded and Recents open for stable assertions. */
export async function prepareRecentsShell(page: Page) {
  await page.context().addCookies([
    { name: "recents_open", value: "1", url: baseURL },
    { name: "sidebar_state", value: "true", url: baseURL },
  ]);
}

export function recentsNav(page: Page) {
  return page.getByRole("navigation", { name: "Recents" });
}

export async function openRecentsSection(page: Page) {
  const toggle = recentsNav(page).getByRole("button", { name: "Recents" });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
}

export function waitForRecentRoutePush(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.url().includes("/api/recent-routes") &&
      response.request().method() === "POST",
  );
}

/** Navigate away and wait for the page being left to be pushed onto Recents. */
export async function leaveFor(page: Page, path: string) {
  const pushPromise = waitForRecentRoutePush(page);
  await page.goto(path);
  await pushPromise;
}

export async function getRecentRoutesInSidebar(
  page: Page,
): Promise<RecentRouteEntry[]> {
  await openRecentsSection(page);
  const rows = recentsNav(page).locator("ul > li");
  const count = await rows.count();
  const routes: RecentRouteEntry[] = [];

  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const label =
      (
        await row.locator("span.block.truncate").first().textContent()
      )?.trim() ?? "";
    const caption =
      (await row.locator("span.block.truncate").nth(1).textContent())?.trim() ??
      "";
    routes.push({ href: "", label, caption });
  }

  return routes;
}

export async function fetchRecentRoutesFromApi(
  page: Page,
): Promise<RecentRouteEntry[]> {
  const response = await page.request.get("/api/recent-routes");
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { routes?: RecentRouteEntry[] };
  return payload.routes ?? [];
}

export async function clickRecentRoute(page: Page, label: string | RegExp) {
  await openRecentsSection(page);
  await recentsNav(page).getByRole("button", { name: label }).click();
}
