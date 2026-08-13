import { defineConfig } from "@playwright/test";

// Benchmark config: artifacts OFF so the measurement is test execution,
// not video encoding. Workers left at Playwright's default (half the
// logical cores) so both runners are configured identically.
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  timeout: 120_000,
  use: {
    baseURL: "http://127.0.0.1:8123",
    headless: true,
    viewport: { width: 1280, height: 720 },
    video: "off",
    trace: "off",
    screenshot: "off",
  },
  webServer: {
    command: "python3 -m http.server 8123 --directory fixture",
    url: "http://127.0.0.1:8123",
    reuseExistingServer: false,
    timeout: 30_000,
  },
  reporter: [["list"]],
});
