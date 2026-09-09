import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testMatch: "battle.spec.ts",
  outputDir: "test-results/container",
  use: {
    ...base.use,
    baseURL: "https://localhost:3443",
    ignoreHTTPSErrors: true,
  },
  webServer: undefined,
});
