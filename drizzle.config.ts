import { defineConfig } from "drizzle-kit";

// Generates SQL only; `wrangler d1 migrations apply` runs it (docs/adr/0003).
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
});
