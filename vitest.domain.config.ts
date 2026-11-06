import { defineConfig } from "vitest/config";

// Used by Stryker (stryker.config.json) only. Domain code is pure, so it runs in plain Node
// without the Cloudflare pool, which Stryker's runner can't drive. `pnpm test` still runs
// these same files under vitest.config.ts.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/domain/**/*.test.ts", "tests/unit/**/*.reference-mirror.test.ts"],
  },
});
