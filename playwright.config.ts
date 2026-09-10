import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_WEB_PORT ?? 3000);
const serverPort = Number(process.env.E2E_SERVER_PORT ?? 2567);
for (const value of [port, serverPort])
  if (!Number.isInteger(value) || value < 1 || value > 65535)
    throw new Error("E2E ports must be integers from 1 to 65535");
const baseURL = `http://localhost:${port}`;
const development = process.env.E2E_DEV === "1";
const reuseExistingServer = process.env.E2E_REUSE_SERVERS === "1";

export default defineConfig({
  testDir: "./tests",
  outputDir: development ? "test-results/dev" : "test-results/production",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  failOnFlakyTests: true,
  timeout: 150_000,
  expect: { timeout: 8_000 },
  reporter: "list",
  use: {
    baseURL,
    browserName: "chromium",
    viewport: { width: 1280, height: 900 },
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "bun run start:server",
      env: {
        PORT: String(serverPort),
        WEB_ORIGIN: baseURL,
        NODE_ENV: "production",
      },
      url: `http://127.0.0.1:${serverPort}/health`,
      reuseExistingServer,
      timeout: 30_000,
    },
    {
      command: development
        ? `bun run --cwd apps/web dev --port ${port}`
        : "bun run --cwd apps/web start",
      env: { PORT: String(port), HOSTNAME: "0.0.0.0" },
      url: baseURL,
      reuseExistingServer,
      timeout: 60_000,
    },
  ],
});
