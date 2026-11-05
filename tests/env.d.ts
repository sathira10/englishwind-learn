import type { D1Migration } from "@cloudflare/vitest-plugin";

// Bindings the test config adds on top of wrangler.jsonc.
declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
