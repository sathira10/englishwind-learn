import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Tests run inside workerd with real local D1 and R2 (docs/testing.md). Migrations are read here
// and applied in tests/setup.ts, so every test file sees the current schema.
export default defineConfig(async () => {
  const migrations = await readD1Migrations("src/db/migrations");
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
      }),
    ],
    test: {
      include: ["tests/unit/**/*.test.ts", "tests/reference/**/*.test.ts", "src/**/*.test.ts"],
      setupFiles: ["tests/setup.ts"],
    },
  };
});
