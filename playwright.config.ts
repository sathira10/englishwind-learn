import { defineConfig, devices } from "@playwright/test";

// Browser smoke test against the built app: the client and the Worker together, as deployed.
// Kept out of `pnpm check`; run `pnpm test:e2e`. CI runs it.
const port = 4392;

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results",
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${port}`, ...devices["Desktop Chrome"] },
  projects: [{ name: "chromium" }],
  webServer: {
    command: `pnpm build && pnpm preview --port ${port} --strictPort`,
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
