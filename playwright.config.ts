import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100",
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm dev --hostname 127.0.0.1 --port 3100",
    env: {
      APP_ORIGIN: "http://127.0.0.1:3100",
      ENABLE_LIVE_PAYMENTS: "false",
      ENABLE_LOCAL_DEMO_AUTH: "true",
      PAYMENT_MODE: "sandbox",
      SESSION_HASH_PEPPER: "4f3d7a9b2c6e8f10457d9a3c5e7b1d4f8a2c6e0b3d7f9a1c5e8b2d6f0a4c7e9b",
      TUBERBOT_ORDER_DEMO_MODE: "true",
    },
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
  ],
});
