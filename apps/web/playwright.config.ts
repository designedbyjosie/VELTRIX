import { defineConfig } from "@playwright/test";

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3000", launchOptions: { executablePath }, trace: "retain-on-failure" },
  webServer: { command: "npx next dev -p 3000", url: "http://localhost:3000/api/health", reuseExistingServer: true, timeout: 180_000 },
});
