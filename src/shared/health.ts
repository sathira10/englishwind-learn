import { z } from "zod";

// GET /api/health. `db` is true when D1 answered a trivial query.
export const healthResponse = z.object({
  ok: z.literal(true),
  db: z.boolean(),
});

export type HealthResponse = z.infer<typeof healthResponse>;
