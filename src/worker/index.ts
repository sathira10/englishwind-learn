import { Hono } from "hono";
import { health } from "./routes/health";

// Only /api/* reaches this Worker (run_worker_first in wrangler.jsonc). Everything else is a
// static asset or the SPA's index.html.
const app = new Hono<{ Bindings: Env }>().basePath("/api");

app.route("/health", health);
app.notFound((c) => c.json({ error: "not_found" }, 404));

export default app satisfies ExportedHandler<Env>;
