import type { z } from "zod";

/** A non-2xx answer from the API. `code` is the `error` (or Better Auth `code`) of the body. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
  ) {
    super(`API ${status}${code ? ` ${code}` : ""}`);
  }
}

async function send(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, { credentials: "same-origin", ...init });
  if (res.ok) return res;
  const body = (await res.json().catch(() => null)) as { error?: unknown; code?: unknown } | null;
  const code =
    typeof body?.error === "string"
      ? body.error
      : typeof body?.code === "string"
        ? body.code
        : undefined;
  throw new ApiError(res.status, code);
}

/** GET a path and check the answer against its schema. */
export async function getJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  return schema.parse(await (await send(path)).json());
}

/** POST JSON and check the answer against its schema. */
export async function postJson<T>(path: string, schema: z.ZodType<T>, body?: unknown): Promise<T> {
  const res = await send(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return schema.parse(await res.json());
}

/** POST JSON and return the answer unchecked (Better Auth's own routes). */
export async function postRaw(path: string, body: unknown): Promise<unknown> {
  const res = await send(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => null);
}
