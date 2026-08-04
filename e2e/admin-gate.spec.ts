import { test, expect } from "@playwright/test";

// Unauthenticated visitors must never reach admin data — this is the
// primary security invariant of the whole app (client trust = 0).
const PROTECTED_ROUTES = [
  "/admin",
  "/admin/objednavky",
  "/admin/produkty",
  "/admin/zakaznici",
  "/admin/analytika",
  "/admin/ai",
  "/admin/nastavenia",
];

for (const route of PROTECTED_ROUTES) {
  test(`redirects anonymous visitor away from ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(/\/admin\/prihlasenie/);
  });
}

test("root path redirects into the admin shell", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/admin(\/prihlasenie)?/);
});

test("login page renders without crashing", async ({ page }) => {
  await page.goto("/admin/prihlasenie");
  await expect(page.locator("body")).toBeVisible();
});
