import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { healthResponse } from "../../src/shared/health";

describe("GET /api/health", () => {
  it("reports the Worker and D1 as up", async () => {
    const response = await exports.default.fetch("https://learn.test/api/health");
    expect(response.status).toBe(200);
    expect(healthResponse.parse(await response.json())).toEqual({ ok: true, db: true });
  });

  it("answers unknown API paths with a JSON 404", async () => {
    const response = await exports.default.fetch("https://learn.test/api/nope");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });
});
