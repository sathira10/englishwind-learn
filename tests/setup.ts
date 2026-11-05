import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Every test file sees the current schema. Applying is idempotent.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
