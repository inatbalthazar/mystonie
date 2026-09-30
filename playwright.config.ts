import { defineConfig, devices } from "@playwright/test";

// Card screenshot + export tests. Locally they reuse a running `pnpm dev` and installed Chrome.
export default defineConfig({
  testDir: "e2e",
  outputDir: "test-results",
  globalSetup: "./e2e/warm-up.ts",
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    ...devices["Pixel 7"],
    channel: process.env.CI ? undefined : "chrome",
    acceptDownloads: true,
    // The app registers a service worker on every page (S3 offline). Tests run without it, as before, except
    // e2e/offline.spec.ts, which is about it.
    serviceWorkers: "block",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
