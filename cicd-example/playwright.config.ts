import { defineConfig } from "@playwright/test";
import { shiplightConfig } from "shiplightai";

export default defineConfig({
  ...shiplightConfig(),

  timeout: 120_000,

  projects: [
    {
      name: "login",
      testDir: "./tests",
      use: {
        baseURL: process.env.BASE_URL ?? "http://localhost:3000",
      },
    },
  ],

  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    video: "on",
    trace: "on",
    screenshot: "on",
  },
});
