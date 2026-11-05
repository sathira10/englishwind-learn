import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { defaultKeyProvider, verifyAccessJwt, type KeyProvider } from "./access";

export type StaffRole = "owner" | "admin";
export interface Staff {
  email: string;
  role: StaffRole;
}
export type AdminEnv = { Bindings: Env; Variables: { staff: Staff } };

export interface RequireStaffOptions {
  keys?: KeyProvider;
  now?: () => number;
}

/**
 * Admin gate. 1) The Access JWT from Cf-Access-Jwt-Assertion (or the CF_Authorization cookie)
 * must verify. 2) Its email must have a row in staff_roles. No other header is read:
 * Cf-Access-Authenticated-User-Email is never trusted (docs/review.md).
 * 401 = no valid token (or Access not configured); 403 = verified but not staff or wrong role.
 */
export function requireStaff(roles?: readonly StaffRole[], options: RequireStaffOptions = {}) {
  const keys = options.keys ?? defaultKeyProvider;
  return createMiddleware<AdminEnv>(async (c, next) => {
    const token = c.req.header("Cf-Access-Jwt-Assertion") ?? getCookie(c, "CF_Authorization");
    const email = token
      ? await verifyAccessJwt(
          token,
          { teamDomain: c.env.ACCESS_TEAM_DOMAIN, audience: c.env.ACCESS_AUD },
          keys,
          options.now,
        )
      : null;
    if (!email) return c.json({ error: "unauthorized" }, 401);

    const row = await c.env.DB.prepare("SELECT role FROM staff_roles WHERE email = ?")
      .bind(email)
      .first<{ role: StaffRole }>();
    if (!row || (roles && !roles.includes(row.role))) return c.json({ error: "forbidden" }, 403);

    c.set("staff", { email, role: row.role });
    await next();
  });
}
