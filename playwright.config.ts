import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }]],
  // Each test hits the real Supabase auth API (no mocking) — give the
  // redirect assertion room for live network latency under parallel load.
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Uses the Vite/Node SSR dev server (not the Cloudflare Workers build) —
  // the nitro "cloudflare-module" preset requires `wrangler dev`, which isn't
  // a good fit for a lightweight local e2e smoke server.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "vite dev --port 4173 --strictPort",
        url: "http://localhost:4173",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
